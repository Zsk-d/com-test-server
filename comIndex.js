const ws = require("nodejs-websocket");
const url = require("url");
const { Com } = require("./ComUtil");
const { readJsonFileSync, writeJsonFileSync } = require("./fileUtil");

const comDataFilePath = "./data/com_data.json";

/**
 * 通信连接参数配置
 */
let comItemsConfig = [];
let coms = {};
const newCom = (item) => {
  let com = new Com(item, (updData) => {
    let { key, value } = updData;
    let keys = key.split(".");
    let tmp = "item";
    for (let i = 0; i < keys.length; i++) {
      tmp += `['${keys[i]}']`;
    }
    tmp += "=" + value;
    eval(tmp);
    item.cws.sendText(
      JSON.stringify({
        action: "update",
        updData,
      })
    );
  });
  coms[item.name] = com;
};
const initComs = () => {
  comItemsConfig.forEach((item) => {
    item.comStatus = 0;
    newCom(item);
  });
};
// 读取已保存的配置
let configs = readJsonFileSync(comDataFilePath);
comItemsConfig = configs ? configs : [];

initComs();

const getItemByName = (name) => {
  let res = null;
  comItemsConfig.forEach((item) => {
    if (item.name == name) {
      res = item;
    }
  });
  return res;
};

const getParamByName = (itemName, sendRecvType, paramName) => {
  let item = getItemByName(itemName);
  let param = null;
  if (item) {
    item[sendRecvType].forEach((iParam) => {
      if (iParam.name == paramName) {
        param = iParam;
      }
    });
  }
  return param;
};

const saveComDataFile = () => {
  writeJsonFileSync(comDataFilePath, comItemsConfig);
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
    if (coms[item.name]) {
      coms[item.name].destroy();
    }
  } else {
    comItemsConfig.push(item);
  }
  newCom(item);
  saveComDataFile();
};
const withoutCws = (key, value) => {
  if (key == "cws") {
    return undefined;
  } else {
    return value;
  }
};
const delAndSaveComItems = (name) => {
  let index = -1;
  for (let i = 0; i < comItemsConfig.length; i++) {
    if (comItemsConfig[i].name == name) {
      index = i;
      break;
    }
  }
  if (index != -1) {
    comItemsConfig.splice(index, 1);
    if (coms[name]) {
      coms[name].destroy();
      delete coms[name];
    }
    saveComDataFile();
  }
};

const addAndSaveItemParam = (name, type, param) => {
  let item = getItemByName(name);
  if (item && !getParamByName(name, type, param.name)) {
    let itemParam = type == "send" ? item.send : item.recv;
    itemParam.push(param);
    saveComDataFile();
  }
  return item;
};

const editAndSaveItemParam = ({ name, type, paramName, value }) => {
  let param = getParamByName(name, type, paramName);
  param.value = value;
  saveComDataFile();
  return getItemByName(name);
};

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
          let res = JSON.stringify(comItemsConfig, withoutCws);
          conn.sendText(res);
        });
      } else if (action == "/item") {
        conn.on("text", function (str) {
          let data = JSON.parse(str);
          let type = data.type;
          if (type == "add") {
            addAndSaveComItems(data.item);
            conn.sendText(
              JSON.stringify({ action: "update", item: data.item })
            );
          } else if (type == "del") {
            delAndSaveComItems(data.name);
          } else if (type == "addParam") {
            let item = addAndSaveItemParam(
              data.data.name,
              data.data.type,
              data.data.param
            );
            conn.sendText(
              JSON.stringify({
                action: "updateParams",
                name: data.data.name,
                type: data.data.type,
                params: item[data.data.type],
              })
            );
          } else if (type == "editParam") {
            // itemName, type, paramName, value
            let item = editAndSaveItemParam(data.data);
            conn.sendText(
              JSON.stringify({
                action: "updateParams",
                name: data.data.name,
                type: data.data.type,
                params: item[data.data.type],
              })
            );
          }
        });
      } else if (action == "/connect") {
        // 连接处理
        let itemName = params.name;
        let item = getItemByName(itemName);
        item.cws = conn;
        conn.on("text", function (str) {
          if (str == "connect") {
            coms[itemName].connect();
          } else if (str == "disconnect") {
            coms[itemName].destroy();
          } else if (str == "send") {
            coms[itemName].send();
          }
        });
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
