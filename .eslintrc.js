module.exports = {
  extends: ['@gaoding/eslint-config-typescript'],
  rules: {
    "promise/param-names": 0,
    "no-undef": 0

  },
  globals: {
    "Worker": true,
    "File": true,
    "FileReader": true,
  }
}
