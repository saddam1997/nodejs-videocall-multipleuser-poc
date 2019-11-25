// https://www.webrtc-experiment.com/

var fs = require('fs');
var url = require('url');
var path = require('path');
// don't forget to use your own keys!
var options = {
    key: fs.readFileSync('server.key'),
    cert: fs.readFileSync('server.cert')
};
function serverHandler(request, response) {
    try {
        var uri = url.parse(request.url).pathname,
            filename = path.join(process.cwd(), uri);

        if (filename && filename.search(/server.js/g) !== -1) {
            response.writeHead(404, {
                'Content-Type': 'text/plain'
            });
            response.write('404 Not Found: ' + path.join('/', uri) + '\n');
            response.end();
            return;
        }

        var stats;

        try {
            stats = fs.lstatSync(filename);
        } catch (e) {
            response.writeHead(404, {
                'Content-Type': 'text/plain'
            });
            response.write('404 Not Found: ' + path.join('/', uri) + '\n');
            response.end();
            return;
        }

        if (fs.statSync(filename).isDirectory()) {
            response.writeHead(404, {
                'Content-Type': 'text/html'
            });

            filename += '/index.html';
        }


        fs.readFile(filename, 'utf8', function(err, file) {
            if (err) {
                response.writeHead(500, {
                    'Content-Type': 'text/plain'
                });
                response.write('404 Not Found: ' + path.join('/', uri) + '\n');
                response.end();
                return;
            }

            response.writeHead(200);
            response.write(file, 'utf8');
            response.end();
        });
    } catch (e) {
        response.writeHead(404, {
            'Content-Type': 'text/plain'
        });
        response.write('<h1>Unexpected error:</h1><br><br>' + e.stack || e.message || JSON.stringify(e));
        response.end();
    }
}
// HTTPs server
var app = require('https').createServer(options, serverHandler);


// socket.io goes below

var io = require('socket.io').listen(app, {
    log: true,
    origins: '*:*'
});

io.set('transports', [
    // 'websocket',
    'xhr-polling',
    'jsonp-polling'
]);

var channels = {};

io.sockets.on('connection', function (socket) {
    var initiatorChannel = '';
    if (!io.isConnected) {
        io.isConnected = true;
    }

    socket.on('new-channel', function (data) {
        if (!channels[data.channel]) {
            initiatorChannel = data.channel;
        }

        channels[data.channel] = data.channel;
        onNewNamespace(data.channel, data.sender);
    });

    socket.on('presence', function (channel) {
        var isChannelPresent = !! channels[channel];
        socket.emit('presence', isChannelPresent);
    });

    socket.on('disconnect', function (channel) {
        if (initiatorChannel) {
            delete channels[initiatorChannel];
        }
    });
});

function onNewNamespace(channel, sender) {
    io.of('/' + channel).on('connection', function (socket) {
        var username;
        if (io.isConnected) {
            io.isConnected = false;
            socket.emit('connect', true);
        }

        socket.on('message', function (data) {
            if (data.sender == sender) {
                if(!username) username = data.data.sender;
                
                socket.broadcast.emit('message', data.data);
            }
        });
        
        socket.on('disconnect', function() {
            if(username) {
                socket.broadcast.emit('user-left', username);
                username = null;
            }
        });
    });
}

// run app

app.listen(process.env.PORT || 9559);

process.on('unhandledRejection', (reason, promise) => {
  process.exit(1);
});

console.log('Please open SSL URL: https://localhost:'+(process.env.PORT || 9559)+'/');
