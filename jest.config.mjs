export default {
  testEnvironment: 'node',
  transform: {},
  moduleDirectories: ['node_modules', 'src'],
  transformIgnorePatterns: [
    'node_modules/(?!variables/.*)'
  ]
};