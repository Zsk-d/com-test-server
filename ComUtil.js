const net = require("net");
const dgram = require("dgram");
const request = require("request")

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
  params.forEach(
    ({ type, length, lengthType, value, fill, fillValue, loc }) => {
      if (type == "str") {
        if (fill == "") {
          fill = "right";
          fillValue = 0;
        }
        let offset = 0;
        if (value.length < length) {
          offset = length - value.length;
        }
        if (
          lengthType == "DC" &&
          (fill == "left" || fill == "") &&
          offset != 0
        ) {
          for (let i = 0; i < offset; i++) {
            buffer.writeInt8(eval(`0x${fillValue}`), wIndex);
            wIndex++;
          }
        }
        value = value.slice(0, length);
        buffer.write(value, wIndex);
        wIndex += Buffer.byteLength(value, "utf-8");
        if (lengthType == "DC" && fill == "right" && offset != 0) {
          for (let i = 0; i < offset; i++) {
            buffer.writeInt8(eval(`0x${fillValue}`), wIndex);
            wIndex++;
          }
        }
      } else if (type == "int32") {
        if (loc == "big") {
          buffer.writeInt32BE(parseInt(value), wIndex);
        } else {
          buffer.writeInt32LE(parseInt(value), wIndex);
        }
        wIndex += 4;
      } else if (type == "byte") {
        buffer.writeInt8(parseInt(value), wIndex);
        wIndex += 1;
      }
    }
  );
  return buffer;
};
/**
 *
 * @param {Object} params
 * @param {Buffer} buffer
 * @returns
 */
const readComBuffer = (params, buffer) => {
  let res = [];
  let rIndex = 0;
  params.forEach(({ type, length, fill = "right", fillValue = 0, loc }) => {
    if (type == "str") {
      let fLength = parseInt(length);
      let value = buffer.toString("utf-8", rIndex, rIndex + fLength);
      let fillChart = Buffer.from([eval(`0x${fillValue}`)]).toString();
      if (fill == "left") {
        let index = value.lastIndexOf(fillChart);
        if (index != -1) {
          value = value.slice(index + 1);
        }
      } else {
        let index = value.indexOf(fillChart);
        if (index != -1) {
          value = value.slice(0, index);
        }
      }
      rIndex += fLength;
      res.push(value);
    } else if (type == "int32") {
      let value = null;
      if (loc == "big") {
        value = buffer.readInt32BE(rIndex);
      } else {
        value = buffer.readInt32LE(rIndex);
      }
      res.push(value);
      rIndex += 4;
    } else if (type == "byte") {
      res.push(buffer.readInt8(rIndex));
      rIndex += 1;
    }
  });
  return res;
};

class Com {
  constructor(option, updateCb, recvCb) {
    this.option = option;
    this.updateCb = updateCb;
    this.recvCb = recvCb;
    this.init();
  }

  init() {
    if (this.option.type == "TC") {
      this.comObj = new TcpClient(
        this.option.comServer,
        (res) => {
          this.updateValue("comStatus", 1);
        },
        (res) => {
          this.recvCb(res);
        },
        (res) => {
          this.updateValue("comStatus", 0);
        },
        this.option.send,
        this.option.recv
      );
    } else if (this.option.type == "HC") {
      this.comObj = new HttpClient(
        this.option.comServer,
        (res) => {
          this.recvCb(res);
        },
        this.option.send,
        this.option.recv,
        this.option
      );
    } else if (this.option.type == "UC") {
      this.comObj = new UdpClient(
        this.option.comServer,
        (res) => {
          this.recvCb(res);
        },
        this.option.send,
        this.option.recv
      );
    } else if (this.option.type == "TS") {
      this.comObj = new TcpServer(
        this.option.port,
        (res) => {
          this.updateValue("listenStatus", res);
        },
        (res) => {
          this.updateValue("comStatus", 1);
        },
        (res) => {
          this.recvCb(res);
        },
        (res) => {
          this.updateValue("comStatus", 0);
        },
        this.option.send,
        this.option.recv
      );
    } else if (this.option.type == "US") {
      this.comObj = new UdpServer(
        this.option.port,
        (res) => {
          this.updateValue("listenStatus", res);
        },
        (res) => {
          this.recvCb(res);
        },
        this.option.send,
        this.option.recv
      );
    }
  }
  connect() {
    this.comObj.connect();
  }
  listen(isListen) {
    this.comObj.listen(isListen);
  }
  send() {
    if (this.comObj && this.comObj.send) {
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
    this.onData = onData;
    this.client = new net.Socket({ readable: true, writable: true });
    this.client.on("connect", (e) => {
      onConnect();
      console.log("connect");
    });
    this.client.on("data", (buffer) => {
      let res = readComBuffer(this.recvParams, buffer);
      this.onData(res);
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
  onListening;
  destroy() {
    this.client.destroy();
  }
}
class TcpServer {
  constructor(
    port,
    onListening,
    onConnect,
    onData,
    onClose,
    sendParams,
    recvParams
  ) {
    this.port = port;
    this.sendParams = sendParams;
    this.recvParams = recvParams;
    this.onListening = onListening;
    this.onData = onData;
    this.onClose = onClose;
    this.server = net.createServer((socket) => {
      onConnect();
      this.client = socket;
      socket.on("data", (buffer) => {
        let res = readComBuffer(this.recvParams, buffer);
        this.onData(res);
      });

      socket.on("end", () => {
        console.log("bye bye ~");
        onClose();
      });

      socket.on("error", () => {
        console.log("error");
      });
    });
    this.server.maxConnections = 1;
    this.server.on("close", () => {
      onListening(0);
    });
  }
  listen(isListen) {
    if (isListen) {
      this.server.listen(parseInt(this.port), "0.0.0.0", 1, () => {
        this.onListening(1);
      });
    } else {
      if (this.client) {
        this.client.destroy();
        this.onClose();
      }
      this.server.close();
    }
  }
  send() {
    let buffer = getComBuffer(this.sendParams);
    this.client.write(buffer);
  }
  destroy() {
    if (this.client) {
      this.client.destroy();
    }
    if (this.server) {
      this.server.close();
    }
  }
}
class UdpClient {
  constructor(server, onData, sendParams, recvParams) {
    this.server = server;
    this.sendParams = sendParams;
    this.recvParams = recvParams;
    this.onData = onData;
    this.client = dgram.createSocket('udp4');

    this.client.on("data", (buffer) => {
      let res = readComBuffer(this.recvParams, buffer);
      this.onData(res);
    });
    this.client.on("error", (e) => {
      console.log("err", e);
    });
  }
  send() {
    let info = this.server.split(":");
    let buffer = getComBuffer(this.sendParams);
    this.client.send(buffer, 0, buffer.length, parseInt(info[1]), info[0]);
  }
  onListening;
  destroy() {
    try{
      this.client.destroy();
    }catch(e){}
  }
}
class HttpClient {
  constructor(server, onData, sendParams, recvParams, option) {
    this.server = server;
    this.sendParams = sendParams;
    this.recvParams = recvParams;
    this.onData = onData;
    this.client = request;

    // this.client.on("data", (buffer) => {
    //   let res = readComBuffer(this.recvParams, buffer);
    //   this.onData(res);
    // });
    // this.client.on("error", (e) => {
    //   console.log("err", e);
    // });
  }
  send() {
    let info = this.server.split(":");
    let buffer = getComBuffer(this.sendParams);
    this.client.send(buffer, 0, buffer.length, parseInt(info[1]), info[0]);
  }
  onListening;
  destroy() {
  }
}
class UdpServer {
  constructor(port, onListening, onData, sendParams, recvParams) {
    this.port = port;
    this.sendParams = sendParams;
    this.recvParams = recvParams;
    this.onListening = onListening;
    this.onData = onData;
  }
  listen(isListen) {
    if (isListen) {
      this.server = dgram.createSocket("udp4");
      this.server.on("error", (err) => {
        console.log(`server error:\n${err.stack}`);
      });
      this.server.on("close", (err) => {
        this.onListening(0);
      });

      this.server.on("message", (buffer, rinfo) => {
        let res = readComBuffer(this.recvParams, buffer);
        this.onData(res);
        if (this.sendParams.length > 0) {
          let buffer = getComBuffer(this.sendParams);
          this.server.send(buffer, 0, buffer.length, rinfo.port, rinfo.address);
        }
      });

      this.server.on("listening", () => {
        const address = this.server.address();
        console.log(`server listening ${address.address}:${address.port}`);
        this.onListening(1);
      });
      this.server.bind(parseInt(this.port));
    } else {
      this.server.close();
    }
  }
  destroy() {
    try{
      this.server.close();
    }catch(e){}
  }
}

module.exports = { Com };
