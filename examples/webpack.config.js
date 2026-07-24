const path = require("path");
const commonConfig = require("@casehubio/pages-webpack-base/webpack.common.config");

module.exports = (env = {}) => {
  const common = commonConfig({ dev: !!env.dev });

  // Filter out the importsNotUsedAsValues option injected by webpack-base
  // in dev mode — removed in TypeScript 5.x (replaced by verbatimModuleSyntax)
  const rules = (common.module?.rules || []).map((rule) => {
    if (rule && rule.test && rule.test.toString() === "/\\.tsx?$/") {
      return {
        ...rule,
        use: (rule.use || []).map((loader) => {
          if (loader && loader.loader && loader.options?.compilerOptions?.importsNotUsedAsValues !== undefined) {
            const { importsNotUsedAsValues, ...restCompilerOptions } = loader.options.compilerOptions;
            return {
              ...loader,
              options: {
                ...loader.options,
                compilerOptions: restCompilerOptions,
              },
            };
          }
          return loader;
        }),
      };
    }
    return rule;
  });

  return {
    ...common,
    module: {
      ...common.module,
      rules,
    },
    entry: {
      "casehub-bundle": path.resolve(__dirname, "src/casehub-entry.ts"),
    },
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "[name].js",
      library: {
        name: "casehubPages",
        type: "umd",
      },
      globalObject: "this",
    },
    resolve: {
      ...common.resolve,
      alias: {
        "@casehubio/pages-runtime": path.resolve(__dirname, "../packages/pages-runtime"),
        "@casehubio/pages-viz": path.resolve(__dirname, "../packages/pages-viz"),
        "@casehubio/pages-ui": path.resolve(__dirname, "../packages/pages-ui"),
        "@casehubio/pages-component": path.resolve(__dirname, "../packages/pages-component"),
        "@casehubio/pages-data": path.resolve(__dirname, "../packages/pages-data"),
        "@casehubio/pages-primitives": path.resolve(__dirname, "../packages/pages-primitives"),
        "@casehubio/pages-ui-components/input": path.resolve(__dirname, "../packages/pages-ui-components/dist/input"),
        "@casehubio/pages-ui-components/select": path.resolve(__dirname, "../packages/pages-ui-components/dist/select"),
        "@casehubio/pages-ui-components/textarea": path.resolve(__dirname, "../packages/pages-ui-components/dist/textarea"),
        "@casehubio/pages-ui-components/checkbox": path.resolve(__dirname, "../packages/pages-ui-components/dist/checkbox"),
        "@casehubio/pages-ui-components/button": path.resolve(__dirname, "../packages/pages-ui-components/dist/button"),
        "@casehubio/pages-ui-components": path.resolve(__dirname, "../packages/pages-ui-components"),
      },
    },
  };
};
