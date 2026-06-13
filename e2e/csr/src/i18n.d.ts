declare const i18n: import("kiru/router").InternationalizationConfig<readonly ["en", "fr"], {
    default: {
        title: string;
        home: {
            greeting: string;
        };
    };
} | {
    default: {
        title: string;
        home: {
            greeting: string;
        };
    };
}>;
declare module "kiru/router" {
    interface Internationalization {
        config: typeof i18n;
    }
}
export default i18n;
//# sourceMappingURL=i18n.d.ts.map