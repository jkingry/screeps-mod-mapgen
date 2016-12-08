var _ = require("lodash");
var q = require("q");

var utils = require("./utils");

function isLeftBorder(opt, x, y) {
    if (!opt.borders) return false;

    return x >= opt.startX && x < (opt.startX + opt.borders.left);
}

function isRightBorder(opt, x, y) {
    if (!opt.borders) return false;

    return x <= opt.endX && x > (opt.endX - opt.borders.left);
}

function isTopBorder(opt, x, y) {
    if (!opt.borders) return false;

    return y >= opt.startY && y < (opt.startY + opt.borders.top);
}

function isBottomBorder(opt, x, y) {
    if (!opt.borders) return false;

    return y <= opt.endY && y > (opt.endY - opt.borders.bottom);
}

function isBorder(opt, x, y) {
    return isLeftBorder(opt, x, y) || isRightBorder(opt, x, y) || isTopBorder(opt, x, y) || isBottomBorder(opt, x, y);
}

function isCenter(opt, x, y) {
    if (!opt.center || !opt.centerSize || opt.sizeX < opt.centerSize || opt.sizeY < opt.centerSize) return false;

    x = x - opt.startX;
    y = y - opt.startY;
    var c = opt.centerSize;
    var mx = Math.floor((opt.sizeX - opt.centerSize) / 2);
    var my = Math.floor((opt.sizeY - opt.centerSize) / 2);

    return x > mx && x <= (mx + c) && y > my && y <= (my + c);
}

function createGenerateOptions(opt, x, y) {
    var template = opt.default;

    if (isBorder(opt, x, y)) {
        template = opt.border;
    } else if (isCenter(opt, x, y)) {
        template = opt.center;
    }

    var roomOpt = _.assign({ exits: {} }, template);

    if (x == opt.startX && opt.closed.left) {
        roomOpt.exits.left = [];
    }
    if (x == opt.endX && opt.closed.right) {
        roomOpt.exits.right = [];
    }
    if (y == opt.startY && opt.closed.top) {
        roomOpt.exits.top = [];
    }
    if (y == opt.endY && opt.closed.bottom) {
        roomOpt.exits.bottom = [];
    }

    if (template.terrainType && (typeof template.terrainType === 'function')) {
        roomOpt.terrainType = template.terrainType();
    }

    if (template.swampType && (typeof template.swampType === 'function')) {
        roomOpt.swampType = template.swampType();
    }

    return roomOpt;
}

function findMapRange(opt, rooms) {
    var findStart = !opt.start;
    var findEnd = !(opt.end || opt.sizeX || opt.sizeY);

    if (rooms && (findStart || findEnd)) {
        for (var room of rooms) {
            var [x, y] = utils.roomNameToXY(room._id);

            if (!opt.start || x < opt.startX || y < opt.startY) {
                opt.start = room._id;
                opt.startX = x;
                opt.startY = y;
            }

            if (findEnd && (!opt.end || x > opt.startX || y > opt.startY)) {
                opt.end = room._id;
                opt.endX = x;
                opt.endY = y;
            }
        }
    }

    if (!opt.startX || !opt.startY) {
        [opt.startX, opt.startY] = utils.roomNameToXY(opt.start);
    }

    if (!opt.end) {
        opt.sizeX = opt.sizeX || 0;
        opt.sizeY = opt.sizeY || 0;

        opt.endX = opt.startX + opt.sizeX;
        opt.endY = opt.startY + opt.sizeY;
        opt.end = utils.roomNameFromXY(opt.endX, opt.endY);
    } else if (!opt.endX || !opt.endY) {
        [opt.endX, opt.endY] = utils.roomNameToXY(opt.end);
    }

    if (opt.startX > opt.endX) {
        [opt.endX, opt.startX] = [opt.startX, opt.endX];
    }
    if (opt.startY > opt.endY) {
        [opt.endY, opt.startY] = [opt.startY, opt.endY];
    }

    opt.start = utils.roomNameFromXY(opt.startX, opt.startY);
    opt.end = utils.roomNameFromXY(opt.endX, opt.endY);

    opt.sizeX = opt.endX - opt.startX;
    opt.sizeY = opt.endY - opt.startY;
}

const defaultOptions = {
    centerSize: 3,


    default: {},

    borders: { top: 1, bottom: 1, left: 1, right: 1 },
    closed: { top: true, bottom: true, left: true, right: true },

    border: {
        sources: 0,
        mineral: false,
        controller: false,
        terrainType: () => Math.floor(Math.random() * 2) + 1,
        swampType: () => Math.floor(Math.random() * 3)
    },

    center: {
        sources: 4,
        keeperLairs: true,
        controller: false
    }
}

function register(sandbox) {
    sandbox.map.createMap = utils.withHelp([
        `createMap([opts]) - Generates a dictionary of options for 'generateMap'. 'opts' is an object with the following optional properties:\r
    * [start] - name of starting room corner
    * [end] - name of ending room corner
    * [size] - size of the map
    * [sizeX] - size of map in X direction
    * [sizeY] - size of map in Y direction
    * [quiet] - suppress printing of progress messages
 
    If you don't specify a square ('start' and 'end' or 'start' and 'size') then will use whole map
    Borders Closed:
    * [closed] - 
        * [top] - true
        * [bottom] - true
        * [left] - true
        * [right] - true
    Size of borders
    * [borders] - 
        * [top] - 1
        * [bottom] - 1
        * [left] - 1
        * [right] - 1
    * [centerSize] - (default: 3) the size of the center room area square

    * [default], [border], [center] - the options for these types of rooms, see 'generateRoom' for details
      Note that 'terrainType' and 'swampType' can be functions.
    
    Example:
        Add a new 10 x 10 EAST NORTH sector to the default WEST NORTH sector and make a two border 'highway' between the two

        map.createMap({start: 'W0N0', end: 'E10N10', closed: { left: false }, borders { left: 2 }})
    `,
        function (options) {
            var opt = _.merge({}, defaultOptions, options || {});
            if (opt.size) {
                opt.sizeX = opt.size;
                opt.sizeY = opt.size;
            }

            var configureTask = opt.start && (opt.end || opt.size || opt.sizeX || opt.sizeY)
                ? q.when()
                : sandbox.storage.db.rooms.find({});

            return configureTask
                .then(rooms => {
                    findMapRange(opt, rooms);

                    sandbox.print(opt);

                    var map = {};
                    for (var x = opt.startX; x <= opt.endX; ++x) {
                        for (var y = opt.startY; y <= opt.endY; ++y) {
                            var roomName = utils.roomNameFromXY(x, y);
                            var roomOpt = createGenerateOptions(opt, x, y);

                            map[roomName] = roomOpt;
                        }
                    }

                    map._map = true;

                    return q.when(map);
                });
        }]);

    sandbox.map.generateMap = utils.withHelp([
        `generateMap([opts]) - generates a new map.
        * [opt] - can be either the options object passed to 'createMap' or the result of 'createMap'`,
        function (options) {
            options = options || {};

            var opt = options._map ? options : _.merge({}, defaultOptions, options);

            var wasPaused = false;
            return sandbox.storage.env.get(sandbox.storage.env.keys.MAIN_LOOP_PAUSED)
                .then(paused => {
                    if (paused === '1') {
                        wasPaused = true;
                        return q.when();
                    }
                    if (opt.quiet) sandbox.print('pausing simulation');

                    return sandbox.system.pauseSimulation();
                })
                .then(() => opt._map ? q.when(opt) : sandbox.map.createMap(opt))
                .then(map => {
                    var work = [];

                    if (map._map) {
                        delete map._map;
                    }

                    for (var roomName in map) {
                        work.push({ roomName: roomName, opt: map[roomName] });
                    }

                    return _.reduce(
                        work,
                        (soFar, w) => soFar
                            .then(() => sandbox.storage.db.rooms.findOne({ _id: w.roomName }))
                            .then(obj => {
                                if (obj) {
                                    if (opt.quiet) sandbox.print('Removing ' + obj._id);
                                    return sandbox.map.removeRoom(obj._id);
                                }

                                return q.when();
                            })
                            .then(() => {
                                if (opt.quiet) sandbox.print('Generating ' + w.roomName);
                                return sandbox.map.generateRoom(w.roomName, w.opt)
                            }),
                        q.when());
                })
                .then(() => wasPaused ? q.when() : sandbox.system.resumeSimulation())
                .then(() => 'OK');
        }]);

    sandbox.map._help = utils.generateCliHelp('map.', sandbox.map);
}

module.exports = function (config) {
    if (config.cli) {
        config.cli.on('cliSandbox', function (sandbox) {
            register(sandbox);
        });
    }
};
