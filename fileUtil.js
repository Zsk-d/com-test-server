const fs = require("fs");

const readJsonFileSync = (path) => {
  let res = null;
  try {
    let data = fs.readFileSync(path, { encoding: "utf8", flag: "r" });
    res = JSON.parse(data);
  } catch (error) {}
  return res;
};
const withoutCws = (key,value)=>{
  if(key == 'cws'){
    return undefined;
  }else{
    return value;
  }
};
const writeJsonFileSync = (path, obj) => {
  let str = JSON.stringify(obj,withoutCws);
  fs.writeFileSync(path, str);
};

module.exports = { readJsonFileSync, writeJsonFileSync };
