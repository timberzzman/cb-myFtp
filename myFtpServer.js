const net = require('net')
const fs = require('fs')
const users = require('./config/users.json')
const port = process.argv[2]
let connected = {}

if (!port) {
  console.log(`Usage: node server.js <port>`)
  process.exit(1)
}

const server = net.createServer((socket) => {
  let session = {
    username: '',
    state: 0,
    current: process.cwd()
  }
  const id = Math.floor(Math.random() * 100)
  connected[id] = session
  console.log(`new connection from ${socket.address().address} at id ${id}`)
  socket.on('data', (data) => {
    checkCommands(socket, data, id)
  })
  socket.on('error', (data) => {
    console.log(data.toString())
    socket.destroy()
  })
})

server.listen(port, () => {
  console.log(`Server started at ${port}`)
})

/**
 * Check if User exists in the database
 * IF found, send 331 ELSE send 430
 * @param  {String} data - the username the client sends
 * @param  {number} id - the ID of the client
 * @param  {Socket} socket - the socket with the client
 * @return {Boolean}
 */
function checkUser(data, id, socket) {
  for (element in users) {
    if (data === users[element].username) {
      connected[id].username = data
      connected[id].state = 1
      socket.write('331')
      return true
    }
  }
  socket.write('430')
  return false
}

/**
 * Check if the password is the one for the user
 * IF user not send before send 430
 * IF correct send 230 ELSE send 430
 * @param  {String} data - the password the client sends
 * @param  {number} id - the ID of the client
 * @param  {Socket} socket - the socket with the client
 * @return {Boolean}
 */
function checkPassword(data, id, socket) {
  if (connected[id].state === 1) {
    for (element in users) {
      if (data === users[element].password && connected[id].username === users[element].username) {
        connected[id].state = 2
        socket.write('230')
        return true
      }
    }
  }
  socket.write('430')
  return false
}

function LISTCommand(socket, id) {
  try {
    let files = fs.readdirSync(connected[id].current, 'utf-8')
    for (element of files) {
      socket.write(`${element}\n`)
    }
  } catch(err) {
    console.error(`${id}: error when readdir {${err}}`)
  }
}

function CWDCommand(socket, nextPath, id) {
  try {
    let result = fs.realpathSync(`${connected[id].current}${process.platform === 'win32' ? '\\' : '/'}${nextPath}`)
    socket.write(result)
    connected[id].current = result
  } catch(err) {
    console.error(`: error when {${err}}`)
  }
}

function HELPCommand(socket) {
  socket.write('200')
}

function RETRCommand(socket, id) {
  socket.write('200')
}

function STORCommand(socket, id) {
  socket.write('200')
}

function checkCommands(socket, data, id) {
  console.log(`${id}: ${data.toString()}`)
  let [directive, parameter] = data.toString().split(' ')

  switch (directive) {
    case '221':
      socket.destroy()
      break;
    case 'USER':
      checkUser(parameter, id, socket)
      break;
    case 'PASS':
      checkPassword(parameter, id, socket)
      break;
    case 'LIST':
      if (connected[id].state === 2) LISTCommand(socket, id)
      else socket.write('430')
      break;
    case 'CWD':
      if (connected[id].state === 2) CWDCommand(socket, parameter, id)
      else socket.write('430')
      break;
    case 'RETR':
      if (connected[id].state === 2) RETRCommand(socket, id)
      else socket.write('430')
      break;
    case 'STOR':
      if (connected[id].state === 2) STORCommand(socket, id)
      else socket.write('430')
      break;
    case 'PWD':
      if (connected[id].state === 2) socket.write(connected[id].current)
      else socket.write('430')
      break;
    case 'HELP':
      HELPCommand(socket)
      break;
    default:
      socket.write('502');
      break;
  }
}