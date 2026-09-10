export default class {
    /**
     * Constructor
     */
    callbacks: any;
    constructor();
    /**
     * On
     */
    on(_names: any, callback: any): false | this;
    /**
     * Off
     */
    off(_names: any): false | this;
    /**
     * Trigger
     */
    trigger(_name: any, _args?: never[]): false | undefined;
    /**
     * Resolve names
     */
    resolveNames(_names: any): any;
    /**
     * Resolve name
     */
    resolveName(name: any): any;
}
