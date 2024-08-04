module.exports = {
    transform: {
      "^.+\\.tsx?$": "babel-jest"
    },
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
    testEnvironment: "node",
    setupFilesAfterEnv: ["<rootDir>/jest.setup.js"]
  };
  