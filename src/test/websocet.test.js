// import { server } from '../app.js';
// import WebSocket from 'ws';

// describe('WebSocket Tests', function () {
//   let wsClient;
//   let serverInstance;

//   before((done) => {
//     serverInstance = server.listen(() => {
//       wsClient = new WebSocket('ws://localhost:4000');
//       wsClient.on('open', () => done());
//       wsClient.on('error', (err) => done(err));
//     });
//   });

//   after(() => {
//     if (wsClient) {
//       wsClient.close();
//     }
//     if (serverInstance) {
//       serverInstance.close();
//     }
//   });

//   it('should connect to WebSocket server', (done) => {
//     wsClient.on('open', () => {
//       // Add your assertions here
//       done();
//     });

//     wsClient.on('error', (err) => {
//       done(err);
//     });
//   });
// });
