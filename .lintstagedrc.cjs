module.exports = {
  '*.{ts,tsx,js,jsx}': ['eslint --max-warnings=0 --fix', 'prettier --write'],
  '*.{json,md,css,html,yml,yaml}': ['prettier --write'],
};
