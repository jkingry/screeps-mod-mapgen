const _ = require('lodash');

exports.roomNameFromXY = function(x,y) {
    if(x < 0) {
        x = 'W'+(-x-1);
    }
    else {
        x = 'E'+(x);
    }
    if(y < 0) {
        y = 'N'+(-y-1);
    }
    else {
        y = 'S'+(y);
    }
    return ""+x+y;
}

exports.roomNameToXY = function(name) {
    var [match,hor,x,ver,y] = name.match(/^(\w)(\d+)(\w)(\d+)$/);
    if(hor == 'W') {
        x = -x-1;
    }
    else {
        x = +x;
        //x--;
    }
    if(ver == 'N') {
        y = -y-1;
    }
    else {
        y = +y;
        //y--;
    }
    return [x,y];
}

exports.withHelp = function(array) {
    var fn = array[1];
    fn._help = array[0];
    return fn;
};

exports.generateCliHelp = function(prefix, container) {
    return `Available methods:\r\n`+Object.keys(container).filter(i => _.isFunction(container[i])).map(i => ' - ' + prefix + (container[i]._help || i)).join('\r\n');
};