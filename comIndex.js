const ws = require("nodejs-websocket");
const url = require("url");
const { readJsonFileSync, writeJsonFileSync } = require("./fileUtil");

const comDataFilePath = "./data/com_data.json";

/**
 * 通信连接参数配置
 */
let comItemsConfig = [];

// 读取已保存的配置
let configs = readJsonFileSync(comDataFilePath);
comItemsConfig = configs ? configs : [];

const getItemByName = (name) => {
  let res = null;
  comItemsConfig.forEach((item) => {
    if (item.name == name) {
      res = item;
    }
  });
  return res;
};

const addAndSaveComItems = (item) => {
  let index = -1;
  for (let i = 0; i < comItemsConfig.length; i++) {
    if (comItemsConfig[i].name == item.name) {
      index = i;
      break;
    }
  }
  if (index != -1) {
    comItemsConfig[i] = item;
  } else {
    comItemsConfig.push(item);
  }
  writeJsonFileSync(comDataFilePath, comItemsConfig);
};

const delAndSaveComItems = (name) =>{
  let index = -1;
  for (let i = 0; i < comItemsConfig.length; i++) {
    if (comItemsConfig[i].name == name) {
      index = i;
      break;
    }
  }
  if(index != -1){
    comItemsConfig.splice(index,1);
    writeJsonFileSync(comDataFilePath, comItemsConfig);
  }
}

try {
  const server = ws
    .createServer(function (conn) {
      console.log("New connection");
      let wsPath = url.parse(decodeURI(conn.path));
      let params = {};
      if (wsPath.query) {
        let tmp = wsPath.query.split("&");
        tmp.forEach((item) => {
          let tmp2 = item.split("=");
          params[tmp2[0]] = tmp2[1];
        });
      }
      let action = wsPath.pathname;
      if (action == "/getAll") {
        conn.on("text", function (str) {
          let res = JSON.stringify(comItemsConfig);
          conn.sendText(res);
        });
      } else if (action == "/item") {
        conn.on("text", function (str) {
          let data = JSON.parse(str);
          let type = data.type;
          if(type == "add"){
            addAndSaveComItems(data.item);
          }else if(type == "del"){
            delAndSaveComItems(data.name);
          }
        });
      }else if (action == "/connect") {
      } else if (action == "/disconnect") {
      }
      conn.on("error", function (e) {
        // console.log(e);
      });
    })
    .listen(20003);
} catch (error) {
  console.error(error);
}
