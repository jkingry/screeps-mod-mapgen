# screeps-mod-mapgen

A screeps cli mod that facilitates (re)generating the whole map and/or adding sections to the map.

### PLEASE BACKUP YOUR DATABASE FIRST

# Examples

Regenerate the whole map, with a one width border and 3x3 source keeper center

```javascript
map.generateMap()
```


Add a new 10 x 10 EAST NORTH sector and make a 2 x 10 column between EAST/NORTH and WEST/NORTH

```javascript
map.generateMap({start: 'W0N0', end: 'E10N10', closed: { left: false }, borders: { left: 2 }})
```
