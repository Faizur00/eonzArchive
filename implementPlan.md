# eonzArchive — IndexedDB Book Cache Implementation Plan

## 1. Objective

Persist downloaded ebook data in the browser so that restarting the browser, restoring a tab, or refreshing the website does not require downloading the same unchanged book from Google Drive again.

The implementation must:

* Preserve the existing Redis-backed library metadata cache.
* Reuse locally cached book data when its version matches the current library metadata.
* Reinitialize Kookit and reconstruct its renderer from cached bytes.
* Restore the user's last reading position.
* Handle browser storage failures without preventing the user from reading.
* Provide a way to inspect and clear the browser's book cache.

**Out of scope:** Persisting a live renderer instance, replacing Redis, redesigning the reader, or implementing a full offline application.

## 2. Current implementation

Relevant source files:

* [`web/js/reader.js`](https://github.com/Faizur00/eonzArchive/blob/main/web/js/reader.js): fetches book data, initializes Kookit, renders documents, and restores reading positions.
* [`web/js/router.js`](https://github.com/Faizur00/eonzArchive/blob/main/web/js/router.js): restores application routes and retrieves book metadata.
* [`web/js/state.js`](https://github.com/Faizur00/eonzArchive/blob/main/web/js/state.js): maintains runtime state and reader settings.
* [`web/js/main.js`](https://github.com/Faizur00/eonzArchive/blob/main/web/js/main.js): initializes the application and handles the storage-management interface.
* [`web/js/api.js`](https://github.com/Faizur00/eonzArchive/blob/main/web/js/api.js): sends authenticated API requests.
* [`src/services/driveService.js`](https://github.com/Faizur00/eonzArchive/blob/main/src/services/driveService.js): stores the library index in Redis and retrieves book metadata and bytes.
* [`web/index.html`](https://github.com/Faizur00/eonzArchive/blob/main/web/index.html): loads the frontend JavaScript files.

Currently, `Reader.openBook()` downloads `/api/book/:id/stream`, converts the response to an `ArrayBuffer`, and passes it to `buildRendition()`.

The renderer is reconstructed from that buffer, and the saved reading position is restored from `localStorage`. However, the buffer itself exists only in memory, so a fresh page runtime must download the document again.

The existing Drive synchronization already records `md5Checksum`, `modifiedTime`, and `size` for indexed books. These fields can be used to detect changes without introducing a new metadata service.

The frontend uses ordinary JavaScript files rather than a dedicated frontend build pipeline. The simplest solution is therefore to implement a small native IndexedDB wrapper.

## 3. Target architecture

Use three distinct persistence layers.

| Data                                                   | Storage        | Responsibility                                        |
| ------------------------------------------------------ | -------------- | ----------------------------------------------------- |
| Library metadata                                       | Redis          | Share the indexed library across server invocations   |
| Ebook binary data                                      | IndexedDB      | Reuse previously downloaded books in the same browser |
| Reading position and reader preferences                | `localStorage` | Restore the reading session and settings              |
| Kookit renderer, iframes, DOM, current runtime objects | Memory         | Recreate when the application starts                  |

No new backend endpoint is needed for browser caching. The existing streaming endpoint remains the source of book bytes when a cache miss occurs.

## 4. IndexedDB schema

Create a database named `eonzArchiveCache`, with a version number starting at `1`.

Create one object store named `books`, using `fileId` as its primary key.

Each record should contain:

| Field            | Type        | Purpose                                          |
| ---------------- | ----------- | ------------------------------------------------ |
| `fileId`         | String      | Google Drive book ID; primary key                |
| `fingerprint`    | String      | Identifies the indexed version of the book       |
| `buffer`         | ArrayBuffer | The actual ebook bytes                           |
| `sizeBytes`      | Number      | Actual number of bytes stored                    |
| `cachedAt`       | Number      | Timestamp when the cache was written             |
| `lastAccessedAt` | Number      | Timestamp used for least-recently-used eviction  |
| `name`           | String      | Optional title for cache-management displays     |
| `format`         | String      | Book format for diagnostics and cache management |

A single record per book ID is sufficient. When a newer version is downloaded, replace the old record instead of keeping multiple versions of the same book.

Store the actual `ArrayBuffer` using IndexedDB's structured-clone support. Do not encode the entire document as Base64 or put ebook bytes in `localStorage`.

## 5. Version detection and invalidation

A cache entry must not be reused merely because its book ID matches.

Implement a helper that generates a fingerprint from the metadata returned by the existing application.

Use this priority:

1. If `md5Checksum` is available, use it as the fingerprint.
2. Otherwise, use a combination of `modifiedTime` and `size`.
3. If sufficient version metadata is unavailable, do not trust the cached entry for reuse.

The Drive service already exposes these fields in its synchronized library records, so this should not require new Drive API requests.

When reading a cached entry:

* If the stored fingerprint matches the current fingerprint, return the cached bytes.
* If the fingerprints differ, treat the entry as stale, delete or replace it, and download the current version.
* If there is no entry, download the document normally.

**Freshness limitation:** Version detection depends on the library metadata being up to date. Since the existing application uses a synchronized metadata index, a modification in Google Drive will be recognized after that index is refreshed. Do not fetch fresh Google Drive metadata on every cache hit merely to validate the cache; that would undermine the objective of reducing Drive API calls.

## 6. File-by-file implementation

### A. Add `web/js/book-cache.js`

Implement a small global module, exposed as `window.BookCache`, using native IndexedDB.

Its responsibilities should be limited to persistent browser storage, version validation, capacity management, and cache statistics.

Required operations:

* `open()`: open or initialize the database, creating the object store during the appropriate upgrade event.
* `get(fileId, fingerprint)`: retrieve a matching cached book or return a cache miss.
* `put(record)`: store a book and its metadata.
* `delete(fileId)`: remove one book's entry.
* `clear()`: remove all cached ebook records.
* `getStats()`: return the number of cached books and their combined byte size.
* `evictIfNeeded(incomingSize)`: remove least-recently-used records when required to stay within the storage budget.

The database-opening operation should be reused rather than creating a new database connection for every read.

Keep IndexedDB initialization and transactions asynchronous. Handle the database's blocked, unavailable, and failed-open cases without allowing a cache failure to crash the reader.

No SQL, database server, or external frontend library is necessary.

### B. Update `web/index.html`

Load the new script before `reader.js` so the cache module is available when reader operations execute.

The relevant script order should be:

1. `api.js`
2. `book-cache.js`
3. `state.js`
4. `library.js`
5. `reader.js`
6. `annotations.js`
7. `router.js`
8. `main.js`

No frontend bundler or module conversion is required.

### C. Update `web/js/router.js`

`Router.handleReadRoute()` already tries to find the book in `State.books` and otherwise calls `API.getBookInfo()`.

Preserve that behavior, but pass the resulting book metadata into `Reader.openBook()` instead of passing only the book ID, title, and format.

The metadata is needed to determine whether the cached bytes represent the current version.

Make the additional argument optional to avoid breaking any existing direct calls to `Reader.openBook()`. Include it in the saved pending-open request so the retry action can use the same metadata when available.

### D. Update `web/js/reader.js`

Modify `Reader.openBook()` to retrieve bytes through the cache-aware loading process.

The new sequence should be:

1. Wait for the Kookit engine to be ready, as the current implementation does.
2. Determine the book fingerprint from the metadata supplied by the router.
3. Check IndexedDB for a record matching the book ID and fingerprint.
4. If a valid record exists, use its `ArrayBuffer`.
5. Otherwise, fetch `/api/book/:id/stream`, convert the response to an `ArrayBuffer`, and attempt to store it in IndexedDB.
6. Continue opening the book even if the cache write fails.
7. Populate `State.currentBook` with the buffer, ID, name, format, and any other runtime data needed by the reader.
8. Load annotations using the existing process.
9. Call the existing `buildRendition()` method.
10. Restore the reading position through the existing `goToPosition()` logic.

The cache must sit between the stream-fetch operation and renderer initialization. It must not be embedded inside Kookit's rendering classes.

A cache hit should skip the binary streaming request entirely. A cache miss or stale entry should continue through the existing network-fetch path.

Distinguish cache hits from network fetches in loading messages and diagnostic logs, so it is possible to verify that caching is working.

### E. Preserve `web/js/state.js`

Do not attempt to serialize `State.currentRendition`, DOM elements, iframe references, or the full `State` object.

These values represent live runtime state and should be reconstructed when the page starts.

The existing reader-mode, theme, spacing, and other preference persistence can remain unchanged.

### F. Update the storage manager in `web/js/main.js`

The existing storage-management interface assumes that cached books occupy server disk space. The current server cache endpoints are stubs in the direct-streaming architecture.

Update the frontend so its storage information reflects the new browser cache.

Display at least:

* Number of cached books.
* Total browser-cache size.
* A control to clear the local ebook cache.
* The existing library metadata and synchronization information.

The clear-cache control should call `BookCache.clear()` rather than relying on the existing server-side cache-clearing endpoint.

Update the confirmation text to explain that the operation clears locally cached ebook data, not Google Drive files, annotations, or the library index.

The existing server cache endpoints do not need to be removed for this feature.

## 7. Cache retrieval algorithm

The central loading logic should follow this decision sequence:

1. Obtain the current book metadata.
2. Compute a trustworthy fingerprint.
3. Attempt an IndexedDB lookup using the book ID.
4. Compare the stored fingerprint with the current fingerprint.
5. Return the stored buffer on a match and update `lastAccessedAt`.
6. On a miss, fetch the document through the existing authenticated stream endpoint.
7. Attempt to save the resulting buffer and metadata.
8. Return the buffer regardless of whether the cache write succeeded.

A failed cache read should fall back to the normal fetch path. A failed cache write should not prevent the book from opening.

A failed network request should retain the current error behavior rather than being misreported as a cache success.

For the first implementation, do not silently serve a stale version when the fingerprint differs.

## 8. Storage capacity and eviction

IndexedDB has browser-managed storage quotas. A cache that grows without limits may eventually fail to save books.

Implement a bounded least-recently-used cache.

Recommended initial policy:

* Start with a configurable cache budget of **250 MiB**.
* Before writing a book, check whether the new record would exceed the budget.
* If necessary, evict the least-recently-used records until there is sufficient room.
* Use `navigator.storage.estimate()` when available to inform the storage policy, but do not assume that the browser grants the requested amount.
* If a document is too large to fit within the configured budget, keep it in memory for the current reading session without persisting it.
* If the write fails with a quota error, evict eligible entries and retry once.
* If the retry fails, continue opening the document without caching it.

The 250 MiB budget is an initial application policy, not a guarantee about the browser's actual storage quota. It can be adjusted after testing with typical PDF and EPUB sizes.

Do not clear the entire cache automatically when a single write fails.

## 9. Reading-position restoration

Keep using the existing key format:

`eonz.reading.BOOK_ID`

The renderer already attempts to restore the saved position after creating a new rendition. Reuse that mechanism rather than inventing a second position-storage system.

Improve the save lifecycle by:

* Keeping the existing debounced saving on page changes.
* Keeping the existing `beforeunload` handler.
* Adding a `pagehide` handler as an additional opportunity to save the position.
* Clearing pending save timers when appropriate so there is less chance of losing a recent page change.

Do not depend exclusively on unload events; browsers do not guarantee that every shutdown, crash, or process termination will run them. Regular page-change saves remain important.

## 10. Failure handling

The reader should continue to function when browser caching is unavailable.

| Condition                         | Expected behavior                                                         |
| --------------------------------- | ------------------------------------------------------------------------- |
| Matching IndexedDB entry          | Open from cached bytes                                                    |
| Cache miss                        | Fetch and attempt to cache                                                |
| Version mismatch                  | Fetch the current version                                                 |
| IndexedDB unavailable             | Open using the existing network path                                      |
| Cache read error                  | Fall back to network                                                      |
| Cache write error                 | Continue reading without persistence                                      |
| Cache quota exceeded              | Evict LRU records, retry once, then continue without caching if necessary |
| Stream returns an HTTP error      | Preserve normal reader error handling                                     |
| Invalid or unusable cached record | Treat as a miss and fetch again                                           |

Log cache failures for debugging, but avoid showing alarming error notifications when a successful network fetch allows the user to continue reading.

## 11. Testing plan

The current root `package.json` does not define a working application test suite. The feature should be tested against the browser's real IndexedDB implementation, with automated tests added where practical.

### Cache behavior

* [ ] The first opening of a book fetches its bytes and attempts to cache them.
* [ ] Reopening the same book version returns the cached bytes.
* [ ] A cache hit does not call the binary streaming endpoint.
* [ ] A changed fingerprint triggers a new fetch.
* [ ] Replacing an entry does not leave duplicate versions for the same book ID.
* [ ] Clearing the cache removes its records.
* [ ] Cache statistics accurately reflect the stored entries.

### Reader restoration

* [ ] Refreshing a tab with an open book reconstructs Kookit.
* [ ] Restoring a browser session opens the book when the browser restores its reader URL.
* [ ] The last saved reading position is restored.
* [ ] Reader settings and annotations continue to work.
* [ ] Switching themes or reader modes still allows rendition rebuilding.
* [ ] The feature works with PDF, EPUB, and other supported formats.

### Failure and capacity cases

* [ ] IndexedDB access is unavailable or rejected.
* [ ] A cache write fails.
* [ ] Storage quota is exceeded.
* [ ] The configured cache budget triggers LRU eviction.
* [ ] A network request fails.
* [ ] A cache entry has invalid data or outdated metadata.
* [ ] Opening a book larger than the cache budget still works for the current session.

### Acceptance criteria

The implementation is complete when all of the following hold:

1. An unchanged cached book can reopen without downloading its binary content again.
2. The renderer is reconstructed successfully after a fresh page runtime starts.
3. The saved reading position is restored after reconstruction.
4. A version mismatch forces a fresh binary download.
5. Cache failures never prevent an otherwise successful network fetch from being read.
6. Redis continues to manage shared library metadata; IndexedDB manages only browser-local ebook bytes.
7. The storage-management interface reports and clears the browser cache correctly.

## 12. Recommended implementation order

1. Create and test `web/js/book-cache.js`.
2. Register it in `web/index.html`.
3. Pass book metadata from `Router.handleReadRoute()` to `Reader.openBook()`.
4. Integrate fingerprint validation and cache-aware loading into `Reader.openBook()`.
5. Verify position restoration and the retry path.
6. Add bounded storage and LRU eviction.
7. Update the browser-cache statistics and clear-cache interface.
8. Run the regression and failure tests.
9. Verify that repeat openings no longer request the book's binary stream when a valid cached entry exists.

## 13. Important limitation: reopening the tab

IndexedDB preserves the book data, but it does not reopen a browser tab by itself.

To resume reading automatically, the browser must restore the relevant tab and its URL, including the `#/read/BOOK_ID` route. The app can then retrieve the metadata, load the cached bytes, recreate the renderer, and restore the reading position.

If you later want eonzArchive to reopen the last book even when the browser starts with a fresh homepage instead of restoring its previous tabs, that should be a separate **Resume Last Book** feature. It is not required for the IndexedDB cache itself.
