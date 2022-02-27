const fastify = require('fastify')();
const path = require('path');
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });
let serverRestarted = true;
wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    if (message !== 'ping') {
      console.log(`Received message => ${message}`);
    } else {
      console.log('pong');
    }
  });
  ws.send('ho!');
  if (serverRestarted) {
    ws.send('reload');
    serverRestarted = false;
  }
});

fastify.register(require('fastify-static'), {
  root: path.join(__dirname, 'www'),
});

fastify.get('/', function (req, reply) {
  return reply.sendFile('dev.html');
});

// Run the server!
const start = async () => {
  try {
    await fastify.listen(3000);
    console.log(' Serving to http://localhost:3000/');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
