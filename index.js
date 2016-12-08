var _ = require("lodash");
var q = require("q");

var util = require("./utils");

function isBorder(opt, x, y) {
    return opt.border && x == opt.startX || x == opt.endX || y == opt.startY || y == opt.endY;
}

function isCenter(opt, x, y) {
    if (!opt.center || !opt.centerSize) return false;

    return x >= (opt.startX + opt.centerSize) && x < (opt.startX + (2*opt.centerSize)) && y >= (opt.startY + opt.centerSize) && y < (opt.startY + (2*opt.centerSize));
}

function createGenerateOptions(opt, x, y) {    
    var template = opt.default;

    if (isBorder(opt, x, y)) {
        template = opt.border;
    } else if (isCenter(opt, x, y)) {
        template = opt.center;
    }
    
    var roomOpt = _.assign({}, template);

    if (template.terrainType && (typeof template.terrainType === 'function')) {
        roomOpt.terrainType = template.terrainType();
    }

    if (template.swampType && (typeof template.swampType === 'function')) {
        roomOpt.swampType = template.swampType();
    }

    return roomOpt;
}

function findMapRange(rooms, opt) {
    var findStart = !opt.start;
    var findEnd = !(opt.end || opt.sizeX || opt.sizeY);

    if (rooms && (findStart || findEnd)) {
        for (var room of rooms) {
            var [x, y] = utils.roomNameToXY(room._id);

            if (!opt.start || x < opt.startX || y < opt.startY) {
                opt.start = room;
                opt.startX = x;
                opt.startY = y;
            }

            if (findEnd && (!opt.end || x > opt.startX || y > opt.startY)) {
                opt.end = room;
                opt.startX = x;
                opt.startY = y;
            }
        }
    }

    if (!opt.end) {        
        opt.sizeX = opt.sizeX || 0;
        opt.sizeY = opt.sizeY || 0;

        opt.endX = opt.startX + opt.sizeX;
        opt.endY = opt.startY + opt.sizeY;
        opt.end = utils.roomNameFromXY(opt.endX, opt.endY);
    }

    if (opt.startX > opt.endX || opt.startY > opt.endY) {
        var tempX = opt.startX;
        var tempY = opt.startY;
        var temp = opt.start;
        opt.start = opt.end;
        opt.startX = opt.endX;
        opt.startY = opt.endY;
        opt.end = temp;
        opt.endX = opt.startX;
        opt.endY = opt.endY;
    }

    opt.sizeX = opt.endX - opt.startX;
    opt.sizeY = opt.endY - opt.startY;
}

const defaultOptions = {
    centerSize: 3,

    default: {
    },

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
    sandbox.generateMap = function(options) {
        var opt = _.merge({}, defaultOptions, options);
        if (opt.size) {
            opt.sizeX = opt.size;
            opt.sizeY = opt.size;
        }

        var configureTask = opt.start && (opt.end || opt.size || opt.sizeX || opt.sizeY)
            ? q.when()
            : sandbox.storage.db.rooms.find({bus:true}); 
        
        return configureTask
            .then(rooms => { 
                findMapRange(rooms, opt);

                var work = [];
                for(var x = opt.startX; x <= opt.endX; ++x) {
                    for(var y = opt.startY; y <= opt.endY; ++y) {
                        var roomName = utils.roomNameFromXY(x,y);
                        var opt = createGenerateOptions(opt, x, y);

                        work.push({ roomName: roomName, opt: opt});
                    }
                }

                return q.when(work);
            })
            .then(work => JSON.stringify(work));
    }
}

module.exports = function (config) {
	if (config.cli) {
		config.cli.on('cliSandbox', function (sandbox) {
            register(sandbox);
		});
	}
};
