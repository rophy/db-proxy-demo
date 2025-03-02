// Example taken from: https://github.com/sidorares/node-mysql2/blob/master/website/docs/examples/tests/mysql-proxy.mdx

const mysql = require('mysql2');

// https://github.com/sidorares/node-mysql2/issues/1216
// const ClientFlags = require('mysql2/lib/constants/client');

const server = mysql.createServer();

const port = parseInt(process.env.PORT || '3306');
console.log(`Server listening on port: ${port}`);
server.listen(port);

let connectionId = 0;

server.on('connection', (conn) => {
    console.log('Got connection!');

    conn.serverHandshake({
        protocolVersion: '10.6.21',
        serverVersion: '5.6.',
        connectionId: connectionId++,
        statusFlags: 2,
        characterSet: 8,
        // https://github.com/sidorares/node-mysql2/issues/1216
        // capabilityFlags: 0xffffff ^ ClientFlags.COMPRESS,
        capabilityFlags: 0xffffff,
    });

    conn.on('field_list', (table, fields) => {
        console.log('field list:', table, fields);
        conn.writeEof();
    });

    const remote = mysql.createConnection({
        user: process.env.MARIADB_USER,
        database: process.env.MARIADB_DATABASE,
        host: 'mariadb',
        password: process.env.MARIADB_PASSWORD,
    })

    conn.on('query', function(sql) {
        console.log(`proxying query: ${sql}`);
        remote.query(sql, (err) => {
            if (err) {
                console.error(err);
                conn.quit();
                return;
            }
            if (Array.isArray(arguments[1])) {
                // overloaded args, either (err, result :object)
                // or (err, rows :array, columns: array)
                const rows = arguments[1];
                const columns = arguments[2];
                console.log('rows', rows);
                console.log('columns', columns);
                conn.writeTextResult(rows, columns);
                return;
            }
            // response to an 'insert', 'update', or 'delete'
            const result = arguments[1];
            console.log('result', result);
            conn.writeOk(result);
        });
    })

    conn.on('end', remote.end.bind(remote));

    conn.on('error', (err) => {
        console.error('conn err', err);
    });

});

