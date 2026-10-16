// Disposable local SMTP server for CI ONLY. No internet delivery.
// Binds to 127.0.0.1 and records messages to an ephemeral JSONL file.
import net from 'node:net';
import { appendFileSync, writeFileSync } from 'node:fs';

if (process.env.NODE_ENV !== 'test' || !/_ci$|_test$/.test(process.env.DB_NAME || '')) {
  throw new Error('SMTP sink is available only with NODE_ENV=test and a disposable test database.');
}

const port = Number(process.env.MAIL_PORT || 2525);
const filename = process.env.MAIL_TEST_SINK_FILE || '/tmp/circle-smtp-sink.jsonl';
const username = process.env.MAIL_USER || '';
const password = process.env.MAIL_PASSWORD || '';
writeFileSync(filename, '');

const server = net.createServer(socket => {
  socket.setEncoding('utf8');
  socket.write('220 localhost ESMTP Circle integration test\r\n');
  let input = '';
  let authenticated = false;
  let authStage = '';
  let loginUser = '';
  let from = '';
  let to = [];
  let writing = false;
  let message = [];

  function respond(line) {
    socket.write(line + '\r\n');
  }

  function processLine(line) {
    if (writing) {
      if (line === '.') {
        appendFileSync(filename, JSON.stringify({
          from, to, message: message.join('\n'),
        }) + '\n');
        writing = false;
        message = [];
        respond('250 2.0.0 accepted for local testing');
      } else {
        message.push(line.startsWith('..') ? line.slice(1) : line);
      }
      return;
    }

    if (authStage === 'user') {
      loginUser = Buffer.from(line, 'base64').toString('utf8');
      authStage = 'password';
      respond('334 UGFzc3dvcmQ6');
      return;
    }
    if (authStage === 'password') {
      const loginPassword = Buffer.from(line, 'base64').toString('utf8');
      authStage = '';
      authenticated = loginUser === username && loginPassword === password;
      respond(authenticated ? '235 2.7.0 authenticated' : '535 5.7.8 bad credentials');
      return;
    }

    const [verb] = line.split(' ');
    const command = verb.toUpperCase();
    if (command === 'EHLO' || command === 'HELO') {
      respond('250-localhost');
      respond('250-AUTH PLAIN LOGIN');
      respond('250 SIZE 2000000');
    } else if (command === 'AUTH') {
      const pieces = line.split(' ');
      if (pieces[1]?.toUpperCase() === 'PLAIN') {
        const fields = Buffer.from(pieces[2] || '', 'base64').toString('utf8').split('\0');
        authenticated = fields.at(-2) === username && fields.at(-1) === password;
        respond(authenticated ? '235 2.7.0 authenticated' : '535 5.7.8 bad credentials');
      } else if (pieces[1]?.toUpperCase() === 'LOGIN') {
        authStage = 'user';
        respond('334 VXNlcm5hbWU6');
      } else respond('504 5.5.4 unsupported authentication');
    } else if (command === 'MAIL' && authenticated) {
      from = line.slice(5);
      to = [];
      respond('250 2.1.0 sender accepted');
    } else if (command === 'RCPT' && authenticated) {
      to.push(line.slice(8));
      respond('250 2.1.5 recipient accepted');
    } else if (command === 'DATA' && authenticated) {
      writing = true;
      message = [];
      respond('354 End data with <CR><LF>.<CR><LF>');
    } else if (command === 'RSET') {
      writing = false;
      message = [];
      respond('250 2.0.0 reset');
    } else if (command === 'NOOP') respond('250 2.0.0 ok');
    else if (command === 'QUIT') {
      respond('221 2.0.0 goodbye');
      socket.end();
    } else respond('530 5.7.0 authenticate first');
  }

  socket.on('data', chunk => {
    input += chunk;
    // SMTP commands and DATA are terminated with CRLF.
    let end;
    while ((end = input.indexOf('\n')) !== -1) {
      const line = input.slice(0, end).replace(/\r$/, '');
      input = input.slice(end + 1);
      processLine(line);
    }
  });
  socket.on('error', () => {});
});

server.listen(port, '127.0.0.1', () => {
  console.log('Local SMTP integration sink listening on 127.0.0.1:' + port);
});
