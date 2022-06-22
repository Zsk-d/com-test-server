const net = require("net");

const getComBuffer = (params) => {
  if (params.length == 0) {
    return false;
  }
  let buffer = null;
  let length = 0;
  params.forEach((item) => {
    length += parseInt(item.length);
  });
  buffer = Buffer.alloc(length);
  let wIndex = 0;
  params.forEach(({ type, length, value, fill = "right", fillValue = 0,loc }) => {
    if (type == "str") {
      let offset = 0;
      if (value.length < length) {
        offset = length - value.length;
      }
      if (fill == "left" && offset != 0) {
        for (let i = 0; i < offset; i++) {
          buffer.writeInt8(eval(`0x${fillValue}`), wIndex);
          wIndex++;
        }
      }
      value = value.slice(0, length);
      buffer.write(value, wIndex);
      wIndex += value.length;
      if (fill == "right" && offset != 0) {
        for (let i = 0; i < offset; i++) {
          buffer.writeInt8(eval(`0x${fillValue}`), wIndex);
          wIndex++;
        }
      }
    } else if (type == "int32") {
        if(loc == "big"){
            buffer.writeInt32BE(parseInt(value),wIndex);
        }else{
            buffer.writeInt32LE(parseInt(value),wIndex);
        }
        wIndex+= 4;
    }
  });
  return buffer;
};

class Com {
  constructor(option, updateCb) {
    this.option = option;
    this.updateCb = updateCb;
    this.init();
  }

  init() {
    if (this.option.type == "TC") {
      this.comObj = new TcpClient(
        this.option.comServer,
        (res) => {
          this.updateValue("comStatus", 1);
        },
        (res) => {},
        (res) => {
          this.updateValue("comStatus", 0);
        },
        this.option.send,
        this.option.recv
      );
    }
  }
  connect() {
    this.comObj.connect();
  }
  listen() {}
  send() {
    if (this.comObj) {
      this.comObj.send();
    }
  }
  destroy() {
    if (this.comObj) {
      this.comObj.destroy();
    }
  }
  updateValue(key, value) {
    this.updateCb({ key: key, value: value });
  }
}

class TcpClient {
  constructor(server, onConnect, onData, onClose, sendParams, recvParams) {
    this.server = server;
    this.sendParams = sendParams;
    this.recvParams = recvParams;
    this.client = new net.Socket({ readable: true, writable: true });
    this.client.on("connect", (e) => {
      onConnect();
      console.log("connect");
    });
    this.client.on("data", (e) => {
      console.log("data ", e);
    });
    this.client.on("error", (e) => {
      console.log("err", e);
    });
    this.client.on("close", (e) => {
      onClose();
      console.log("close", e);
    });
  }
  connect() {
    let info = this.server.split(":");
    this.client.connect(parseInt(info[1]), info[0], (res) => {
      console.log(`tcp客户端已连接`);
    });
  }
  send() {
    let buffer = getComBuffer(this.sendParams);
    this.client.write(buffer);
  }
  destroy() {
    this.client.destroy();
  }
}
class TcpServer {}
class UdpClient {}
class UdpServer {}

module.exports = { Com };
