export declare const routes: import("kiru/router").RouteTreeDefinition;
export declare const routeLinks: readonly [{
    readonly path: "/";
    readonly displayName: "home";
}, {
    readonly path: "/about";
    readonly displayName: "about";
}, {
    readonly path: "/users/[id]";
    readonly params: {
        readonly id: "42";
    };
    readonly displayName: "user-42";
}, {
    readonly path: "/guarded";
    readonly displayName: "guarded-redirect";
}, {
    readonly path: "/forbidden";
    readonly displayName: "forbidden";
}, {
    readonly path: "/hash-section";
    readonly displayName: "hash-section";
}, {
    readonly path: "/counter";
    readonly displayName: "counter";
}, {
    readonly path: "/effects";
    readonly displayName: "effects";
}, {
    readonly path: "/keyed-list";
    readonly displayName: "keyed-list";
}, {
    readonly path: "/signals";
    readonly displayName: "signals";
}, {
    readonly path: "/style";
    readonly displayName: "style";
}, {
    readonly path: "/todos";
    readonly displayName: "todos";
}, {
    readonly path: "/navigation";
    readonly displayName: "navigation";
}, {
    readonly path: "/csr-break";
    readonly displayName: "csr-break";
}, {
    readonly path: "/csr-break-loader";
    readonly displayName: "csr-break-loader";
}, {
    readonly path: "/loaders/client";
    readonly displayName: "loaders-client";
}, {
    readonly path: "/loaders/universal";
    readonly displayName: "loaders-universal";
}, {
    readonly path: "/photos";
    readonly displayName: "photos";
}];
//# sourceMappingURL=routes.d.ts.map