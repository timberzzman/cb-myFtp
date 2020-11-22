const net = require('net')
const fs = require('fs')
const users = require('./users.json')
const port = process.argv[2]
const connected = {}
let ws

if (!port) {
  console.log('Usage: node server.js <port>')
  process.exit(1)
}

const server = net.createServer((socket) => {
  const session = {
    username: '',
    state: 0,
    current: process.cwd()
  }
  const id = Math.floor(Math.random() * 100)
  connected[id] = session
  console.log(`New connection from ${socket.address().address} at ID ${id}`)
  socket.on('data', (data) => {
    if (data.toString().indexOf('\r\n') > -1 && connected[id] !== 3) {
      const lines = data.toString().split('\r\n')
      for (const element of lines) {
        checkCommands(socket, element, id)
      }
    } else {
      checkCommands(socket, data, id)
    }
  })
  socket.on('error', (data) => {
    console.log(`${id}: ${data.toString()}`)
    console.log(`${id}: Client disconnected. Killing socket`)
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

function checkUser (data, id, socket) {
  for (const element in users) {
    if (data === users[element].username) {
      connected[id].username = data
      connected[id].state = 1
      console.log(`${id}: Connect to user ${data}, need password`)
      socket.write('331')
      return true
    }
  }
  console.log(`${id}: Bad user, sending 430`)
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
function checkPassword (data, id, socket) {
  if (connected[id].state === 1) {
    for (const element in users) {
      if (data === users[element].password && connected[id].username === users[element].username) {
        connected[id].state = 2
        console.log(`${id}: Connected to user ${connected[id].username}, sending 230`)
        socket.write('230')
        return true
      }
    }
  }
  console.log(`${id}: Bad password, sending 430`)
  socket.write('430')
  return false
}

function LISTCommand (socket, id, argument = '') {
  let result = ''
  const path = fs.realpathSync(`${connected[id].current}${process.platform === 'win32' ? '\\' : '/'}${argument}`)
  try {
    const files = fs.readdirSync(path, 'utf-8')
    for (const element in files) {
      result += `${files[element]}${element !== files.length + 1 ? ';' : ''}`
    }
    console.log(`${id}: Sending 200 with list of files`)
    socket.write(`200 LIST|${result}`)
  } catch (err) {
    console.error(`${id}: error when readdir {${err}}`)
  }
}

function CWDCommand (socket, nextPath, id) {
  try {
    const result = fs.realpathSync(`${connected[id].current}${process.platform === 'win32' ? '\\' : '/'}${nextPath}`)
    connected[id].current = result
    console.log(`${id}: Sending 200 with path`)
    socket.write(`200 PATH|${result}`)
  } catch (err) {
    console.error(`: error when {${err}}`)
  }
}

function HELPCommand (socket) {
  socket.write('200 COMMANDS|USER\nPASS\nLIST\nCWD\nPWD\nQUIT\nRETR\nSTOR')
}

function RETRCommand (socket, id, filename) {
  const files = fs.readdirSync(connected[id].current, 'utf-8')
  if (files.indexOf(filename) !== -1) {
    const readable = fs.createReadStream(`${connected[id].current}${process.platform === 'win32' ? '\\' : '/'}${filename}`)
    console.log(`${id}: [${filename}] Sending 150`)
    socket.write(`150 ${filename}\r\n`)
    readable.on('readable', () => {
      let data

      console.log(`${id}: [${filename}] Sending data`)
      while (data = readable.read()) {
        socket.write(data)
      }
    })
    readable.on('end', () => {
      socket.write('\r\n226')
      console.log(`${id}: File [${filename}] send`)
    })
  } else {
    console.log(`${id}: ERROR: file doesn't exist`)
    socket.write('550')
  }
}

function STORCommand (socket, file, id) {
  const filepath = `${connected[id].current}${process.platform === 'win32' ? '\\' : '/'}${file}`
  ws = fs.createWriteStream(filepath)
  console.log(`${id}: Ready to write ${file}`)
  socket.write('125')
}

function checkCommands (socket, data, id) {
  const [directive, parameter] = data.toString().split(' ')

  if (connected[id].state !== 3) console.log(`${id}: ${directive}`)
  switch (directive) {
    case '221':
      console.log(`${id}: Client disconnected. Killing socket`)
      socket.destroy()
      break
    case 'USER':
      checkUser(parameter, id, socket)
      break
    case 'PASS':
      checkPassword(parameter, id, socket)
      break
    case 'LIST':
      if (connected[id].state >= 2) LISTCommand(socket, id, parameter)
      else {
        console.log(`${id}: Client not authenticated`)
        socket.write('430')
      }
      break
    case 'CWD':
      if (connected[id].state >= 2) CWDCommand(socket, parameter, id)
      else {
        console.log(`${id}: Client not authenticated`)
        socket.write('430')
      }
      break
    case 'RETR':
      if (connected[id].state >= 2) RETRCommand(socket, id, parameter)
      else {
        console.log(`${id}: Client not authenticated`)
        socket.write('430')
      }
      break
    case 'STOR':
      if (connected[id].state >= 2) STORCommand(socket, parameter, id)
      else {
        console.log(`${id}: Client not authenticated`)
        socket.write('430')
      }
      break
    case 'PWD':
      if (connected[id].state >= 2) socket.write(connected[id].current)
      else {
        console.log(`${id}: Client not authenticated`)
        socket.write('430')
      }
      break
    case 'HELP':
      HELPCommand(socket)
      break
    case '150':
      connected[id].state = 3
      return
    case '226':
      ws.end()
      connected[id].state = 2
      socket.write('250')
      break
    default:
      if (connected[id].state === 3) {
        ws.write(data)
      } else {
        socket.write('502')
      }
      break
  }
}
