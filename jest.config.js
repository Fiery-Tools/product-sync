module.exports = {
  // Use the ts-jest preset to automatically configure Jest for TypeScript
  preset: 'ts-jest',

  // The environment in which the tests will be run
  testEnvironment: 'node',

  // A list of paths to directories that Jest should use to search for files in
  roots: ['<rootDir>/src/clients'],

  // The file extensions your modules use
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  transform: {
    // Use ts-jest for any file ending in .ts or .tsx
    '^.+\\.tsx?$': 'ts-jest',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'], // Adjust path if needed
};
