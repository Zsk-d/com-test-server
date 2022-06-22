const fs = require("fs");

const readJsonFileSync = (path) => {
  let res = null;
  try {
    let data = fs.readFileSync(path, { encoding: "utf8", flag: "r" });
    res = JSON.parse(data);
  } catch (error) {}
  return res;
};

const writeJsonFileSync = (path, obj) => {
  let str = JSON.stringify(obj);
  fs.writeFileSync(path, str);
};

module.exports = { readJsonFileSync, writeJsonFileSync };
