const decide = require('./decide.js');
const prompt = require('./prompt.js');
const tools = require('./tools.js');

module.exports = {
  ...decide,
  ...prompt,
  ...tools,
};
