/** @type {import("jest").Config} */
module.exports = {
  testEnvironment: "node",

  roots: ["<rootDir>/src", "<rootDir>/tests"],

  testMatch: ["**/*.test.ts", "**/*.spec.ts"],

  transform: {
    "^.+\\.tsx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: {
            syntax: "typescript",
            decorators: false,
          },
          target: "es2022",
        },
        module: {
          type: "commonjs",
        },
      },
    ],
  },

  clearMocks: true,
  restoreMocks: true,

  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts", "!src/server.ts"],

  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov"],
};
