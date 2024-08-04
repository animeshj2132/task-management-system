module.exports = {
    testEnvironment: "node",
    transform: {
      "^.+\\.js$": "babel-jest"
    },
    testMatch: [
      "**/__tests__/**/*.js",
      "**/?(*.)+(spec|test).js"
    ],
    moduleFileExtensions: [
      "js",
      "json",
      "node"
    ],
    setupFilesAfterEnv: [
      "./jest.setup.js"
    ]
  };
  