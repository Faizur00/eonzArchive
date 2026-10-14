export declare const isValidSelection: (sel: Selection | null) => boolean;
export interface SelectionAutoTurnOptions {
    element: HTMLElement;
    iframe: HTMLIFrameElement;
    doc: Document;
    render: any;
    readerMode: string;
    format: string;
    enableScrollPin?: boolean;
}
export interface SelectionAutoTurn {
    onSelectStart: () => void;
    onSelectionChange: () => void;
    onTouchMove: (clientX: number, clientY: number) => void;
    onSelectionCleared: () => void;
    cancelAutoTurn: () => void;
    applyScrollPin: () => void;
    hasActiveSelection: () => boolean;
}
export declare const createSelectionAutoTurn: (options: SelectionAutoTurnOptions) => SelectionAutoTurn | null;
