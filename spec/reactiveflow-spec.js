
if (typeof reactiveflow === 'undefined') {
  var reactiveflow = require('..');
}

(function() {
"use strict";

describe("A reactiveflow context", function() {
  var context;

  beforeEach(function() {
    context = reactiveflow.newContext();
  });

  it("is created via 'newContext'", function() {
    expect(reactiveflow._contextProto.isPrototypeOf(context)).toBe(true);
  });

  it("can check if an id exists via 'hasId'", function() {
    expect(context.hasId('toString')).toBe(false);
    expect(context.hasId('source')).toBe(false);
    context.newSource('source', 0);
    expect(context.hasId('source')).toBe(true);
  });

  describe("has a 'nodes' property that", function() {
    var source;
    var conduit;

    beforeEach(function() {
      source = context.newSource('source', 0);
      conduit = context.newConduit('conduit', {args: source},
        function(args) {
          return args.source + 1;
        }
      );
    });

    it("maps all node ids to nodes", function() {
      expect(context.nodes).toEqual(jasmine.any(Object));
      expect(context.nodes.source).toBe(source);
      expect(context.nodes.conduit).toBe(conduit);
      expect(Object.keys(context.nodes).length).toBe(2);
    });

    it("is read-only and has read-only entries", function() {
      expect(function() { context.nodes = null; }).toThrow();
      expect(function() { context.nodes.source = null; }).toThrow();
    });

    it("has null prototype (so no need for 'hasOwnProperty' checks)", function() {
      expect(Object.getPrototypeOf(context.nodes)).toBe(null);
    });
  });

  it("throws an error if attempting to create a new source " +
    "or conduit using an already existing id",
    function() {
      var node = context.newSource('node', 0);
      expect(function() { context.newSource('node', 1); })
        .toThrowError(/id collision/);
      expect(function() {
        context.newConduit('node', {args: node},
          function(args) {
            return args.node + 1;
          }
        );
      }).toThrowError(/id collision/);
    }
  );

  it("call to 'newSource()' must have a string 'id' argument", function() {
    expect(function() { context.newSource(undefined, 0); }).toThrow();
    expect(function() { context.newSource(10, 0); }).toThrow();
  });

  describe("call to 'newConduit()'", function() {
    var s1, s2, s3;

    beforeEach(function() {
      s1 = context.newSource('s1', 1);
      s2 = context.newSource('s2', 2);
      s3 = context.newSource('s3', 3);
    });

    it("must have a string 'id' argument", function() {
      var source = context.newSource('source', 0);
      expect(function() {
        context.newConduit(undefined, {args: source}, function() {});
      }).toThrowError(/id/);
      expect(function() {
        context.newConduit(10, {args: source}, function() {});
      }).toThrowError(/id/);
    });

    describe("has a 'configOpts' argument", function() {
      it("that is an object", function() {
        expect(function() {
          context.newConduit('conduit', undefined, function() {});
        }).toThrowError(/configOpts/);
        expect(function() {
          context.newConduit('conduit', 'opts', function() {});
        }).toThrowError(/configOpts/);
      });

      describe("with 'args' property that", function() {
        it("is mandatory", function() {
          expect(function() {
            context.newConduit('conduit', {pArgs: s1}, function() {});
          }).toThrowError(/args/);
        });

        it("consists of an item or an array of items, where each " +
          "item is either a node, a valid node id, or a map from " +
          "id aliases to nodes or valid node ids",
          function() {
            expect(function() {
              context.newConduit('conduit', {args: {a: 'badId'}}, function() {});
            }).toThrowError(/badId/);
            expect(function() {
              context.newConduit('conduit', {args: [null]}, function() {});
            }).toThrowError(/null/);

            // These calls are valid:
            context.newConduit('c1', {args: s2}, function() {});
            context.newConduit('c2', {args: [s2, s3]}, function() {});
            context.newConduit('c3', {args: [s2, {alias: s3}]}, function() {});
            context.newConduit('c4', {args: {a2: s2, a3: s3}}, function() {});
            context.newConduit('c5', {args: [s1, {a2: s2, a3: s3}]},
              function() {});
            context.newConduit('c6', {args: 's2'}, function() {});
            context.newConduit('c7', {args: ['s2', {a3: 's3'}]}, function() {});
          }
        );

        it("must not name the same node more than once or reuse aliases", function() {
          expect(function() {
            context.newConduit('conduit', {args: [s1, {a2: s2, a1: s1}]},
              function() {});
          }).toThrow();
          expect(function() {
            context.newConduit('conduit', {args: [s1, {s1: s2}]},
              function() {});
          }).toThrow();
        });
      });

      describe("with optional 'pArgs' property that", function() {
        it("consists of the same allowable types as 'args'", function() {
          expect(function() {
            context.newConduit('conduit', {args: s1, pArgs: 'badId'},
              function() {});
          }).toThrowError(/badId/);
          expect(function() {
            context.newConduit('conduit', {args: s1, pArgs: [null]},
              function() {});
          }).toThrowError(/null/);

          // These calls are valid:
          context.newConduit('c1', {args: s1, pArgs: s2}, function() {});
          context.newConduit('c2', {args: s1, pArgs: [s2, s3]}, function() {});
          context.newConduit('c3', {args: s1, pArgs: [s2, {alias: s3}]},
            function() {});
          context.newConduit('c4', {args: s1, pArgs: {a2: s2, a3: s3}},
            function() {});
          context.newConduit('c5', {args: 's1', pArgs: 's2'}, function() {});
        });

        it("must not name the same node more than once or reuse aliases", function() {
          expect(function() {
            context.newConduit('conduit',
              {args: s3, pArgs: [s1, {a2: s2, a1: s1}]},
              function() {});
          }).toThrow();
          expect(function() {
            context.newConduit('conduit',
              {args: s3, pArgs: [s1, {s1: s2}]},
              function() {});
          }).toThrow();
        });

        it("must not have any nodes or aliases in common with 'args'", function() {
          expect(function() {
            context.newConduit('conduit',
              {args: s1, pArgs: [s2, {a3: s3, a1: s1}]},
              function() {});
          }).toThrow();
          expect(function() {
            context.newConduit('conduit',
              {args: s1, pArgs: {s1: s2}},
              function() {});
          }).toThrow();
        });
      });

      it("where all nodes in 'args' and 'pArgs' must come from " +
        "the same context",
        function() {
          var otherContext = reactiveflow.newContext();
          var otherSource = otherContext.newSource('otherSource');
          expect(function() {
            context.newConduit('conduit',
              {args: [s1, otherSource], pArgs: s2},
              function() {});
          }).toThrowError(/context/);
          expect(function() {
            context.newConduit('conduit',
              {args: s1, pArgs: [s2, otherSource]},
              function() {});
          }).toThrowError(/context/);
        }
      );

      describe("with optional 'initVal' property that", function() {
        var updateObj;
        var updateFuncSpy;

        beforeEach(function() {
          updateObj = {};
          updateObj.func = function(args, currVal, updateMap, node) {
            // Sum all arguments
            var result = 0;
            for (var id in args) {
              result += args[id];
            }
            return result;
          };
          updateFuncSpy = spyOn(updateObj, 'func').and.callThrough();
        });

        it("if missing, will cause the conduit to call updateFunc " +
          "immediately to calculate an initial value, with the " +
          "'currVal' argument undefined and 'updateMap' argument as {}",
          function() {
            var conduit = context.newConduit('conduit', {args: [s1, s2]},
              updateObj.func);
            expect(updateObj.func).toHaveBeenCalled();
            expect(conduit.getValue()).toBe(3);
            var updateFuncArgs = updateObj.func.calls.mostRecent().args;

            // args should be a "clean map" (i.e. inheriting from null)
            expect(Object.getPrototypeOf(updateFuncArgs[0])).toBe(null);
            expect(updateFuncArgs[1]).toBeUndefined();
            // updateMap should be a "clean map" (i.e. inheriting from null)
            expect(updateFuncArgs[2]).toEqual(Object.create(null));
            expect(updateFuncArgs[3]).toBe(conduit);
          }
        );

        it("if defined, will set the initial value and prevent an initial " +
          "call to updateFunc",
          function() {
            var conduit = context.newConduit('conduit',
              {args: [s1, s2], initVal: -1},
              updateObj.func);
            expect(updateObj.func).not.toHaveBeenCalled();
            expect(conduit.getValue()).toBe(-1);
          }
        );
      });

      it("with no other enumerable properties allowed", function() {
        expect(function() {
          context.newConduit('conduit',
            {args: s1, someInvalidProperty: 1},
            function() {});
        }).toThrowError(/someInvalidProperty/);
      });
    });

    it("must have an 'updateFunc' argument of type function", function() {
      expect(function() {
        context.newConduit('conduit', {args: s1});
      }).toThrowError(/updateFunc/);
      expect(function() {
        context.newConduit('conduit', {args: s1}, 'not a function');
      }).toThrowError(/updateFunc/);
    });
  });
});


describe("A reactiveflow node", function() {
  var context;
  var source;
  var conduit;

  beforeEach(function() {
    context = reactiveflow.newContext();
    source = context.newSource('source', 0);
    conduit = context.newConduit('conduit', {args: source},
      function(args) {
        return args.source + 1;
      }
    );
  });

  it("has a read-only 'id' property", function() {
    expect(source.id).toBe('source');
    expect(conduit.id).toBe('conduit');
    expect(function() { source.id = null; }).toThrow();
  });

  it("has a read-only 'context' property for its containing context", function() {
    expect(source.context).toBe(context);
    expect(conduit.context).toBe(context);
    expect(function() { source.context = null; }).toThrow();
  });

  it("has a 'getValue()' method that returns its current value", function() {
    expect(source.getValue()).toBe(0);
    expect(conduit.getValue()).toBe(1);
  });

  it("can have listeners added, removed, and counted", function() {
    var listener1 = function() {};
    var listener2 = function() {};
    expect(source.listenerCount()).toBe(0);
    source.addListener(listener1);
    expect(source.listenerCount()).toBe(1);
    source.addListener(listener2);
    expect(source.listenerCount()).toBe(2);
    source.addListener(listener1);
    expect(source.listenerCount()).toBe(3);
    source.removeListener(listener1);
    expect(source.listenerCount()).toBe(2);
    source.removeListener(listener1);
    expect(source.listenerCount()).toBe(1);
    source.removeListener(listener1);
    expect(source.listenerCount()).toBe(1);
    source.addListener(listener1);
    expect(source.listenerCount()).toBe(2);
    source.removeAllListeners();
    expect(source.listenerCount()).toBe(0);
  });
});


describe("Update behavior for a 'triggerUpdate' call:", function() {
  var context, s1, s2, s3, a1, a2, a3, b1, b2, b3;
  var allConduits;

  // Define an update function that records test info
  var updateFunc = function(args, currVal, updateMap, node) {
    currVal = currVal || {updateCount: -1};
    var argsCopy = Object.create(null);

    // Set the value property to be the max of all argument values
    var maxVal = -Infinity;
    for (var id in args) {
      if (args[id].value > maxVal) {
        maxVal = args[id].value;
      }
      // Halt update for this conduit if halt signal is detected
      if (args[id].halt === node.id) {
        return;
      } else if (typeof args[id].halt !== undefined) {
        currVal.halt = args[id].halt;
      }
      // Deep copy some of the arg properties (excluding updateMap)
      var argCopy = Object.create(null);
      argCopy.value = args[id].value;
      argCopy.updateCount = args[id].updateCount;
      argsCopy[id] = argCopy;
    }
    currVal.value = maxVal;
    currVal.args = argsCopy;
    currVal.updateMap = updateMap;
    currVal.node = node;
    currVal.updateCount++;
    return currVal;
  };

  // Define a helper to check the update counts in an array of nodes
  var allCountsEqual = function(nodes, count) {
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].getValue().updateCount !== count) {
        return false;
      }
    }
    return true;
  };

  beforeEach(function() {
    context = reactiveflow.newContext();

    // See graphviz_diagrams/test_example.png for a visualization of the DAG below
    s1 = context.newSource('s1', {value: 0});
    s2 = context.newSource('s2', {value: 0});
    s3 = context.newSource('s3', {value: 0});

    a1 = context.newConduit('a1', {args: s1, pArgs: s2}, updateFunc);
    a2 = context.newConduit('a2', {args: s2}, updateFunc);
    a3 = context.newConduit('a3', {args: [a2, s3]}, updateFunc);

    b1 = context.newConduit('b1', {args: a1, pArgs: a3}, updateFunc);
    b2 = context.newConduit('b2', {args: [a1, a3]}, updateFunc);
    b3 = context.newConduit('b3', {args: s3, pArgs: a3}, updateFunc);

    allConduits = [a1, a2, a3, b1, b2, b3];
  });

  it("Only descendent nodes of the set of update sources are candidates " +
    "for update triggering",
    function() {
      expect(allCountsEqual(allConduits, 0)).toBe(true);

      // Even updating a source to the same value will trigger further updates
      s3.triggerUpdate({value: 0});
      expect(allCountsEqual([a3, b2, b3], 1)).toBe(true);
      expect(allCountsEqual([a1, a2, b1], 0)).toBe(true);

      context.triggerUpdate({s1: {value: 1}, s2: {value: 2}});
      expect(allCountsEqual([a3, b2], 2)).toBe(true);
      expect(allCountsEqual([a1, a2, b1, b3], 1)).toBe(true);
    }
  );

  it("Passive arguments are passed in to an updating node but don't " +
    "themselves trigger updates",
    function() {
      s2.triggerUpdate({value: 20});
      expect(a1.getValue().value).toBe(0);
      expect(b1.getValue().value).toBe(0);
      expect(b2.getValue().value).toBe(20);

      s1.triggerUpdate({value: 10});
      expect(a1.getValue().value).toBe(20);
      expect(b1.getValue().value).toBe(20);
      expect(Object.keys(b1.getValue().args)).toEqual(['a1', 'a3']);
    }
  );

  it("All nodes are updated at most once within a single 'triggerUpdate' call",
    function() {
      expect(allCountsEqual(allConduits, 0)).toBe(true);
      context.triggerUpdate([s1, s2, s3], [{value: 0}, {value: 0}, {value: 0}]);
      expect(allCountsEqual(allConduits, 1)).toBe(true);
    }
  );

  describe("Before a node is updated", function() {
    it("all of its triggered arguments will be updated first", function() {
      var args;

      context.triggerUpdate([s1, s2], [{value: 0}, {value: 0}]);
      args = b2.getValue().args;
      expect(args.a1.updateCount).toBe(1);
      expect(args.a3.updateCount).toBe(1);

      context.triggerUpdate([s2, s1], [{value: 0}, {value: 0}]);
      args = b2.getValue().args;
      expect(args.a1.updateCount).toBe(2);
      expect(args.a3.updateCount).toBe(2);

      s1.triggerUpdate({value: 0});
      expect(b1.getValue().args.a1.updateCount).toBe(3);
      expect(b2.getValue().args.a1.updateCount).toBe(3);
    });

    it("all of its triggered passive arguments will also be updated first",
      function() {
        var args;

        context.triggerUpdate([s1, s2], [{value: 0}, {value: 0}]);
        args = b1.getValue().args;
        expect(args.a1.updateCount).toBe(1);
        expect(args.a3.updateCount).toBe(1);

        context.triggerUpdate([s2, s1], [{value: 0}, {value: 0}]);
        args = b1.getValue().args;
        expect(args.a1.updateCount).toBe(2);
        expect(args.a3.updateCount).toBe(2);
      }
    );
  });

  it("Each conduit's updateFunc will be called with its 'args' (including " +
    "passive args), its current value, an 'updateMap' containing all " +
    "args that triggered it to update (never passive args), and " +
    "a 'node' reference to itself",
    function() {
      context.triggerUpdate([s1, s2], [{value: 10}, {value: 20}]);
      expect(Object.keys(b1.getValue().args)).toEqual(['a1', 'a3']);
      expect(b1.getValue().updateCount).toBe(1);
      expect(Object.keys(b1.getValue().updateMap)).toEqual(['a1']);
      expect(b1.getValue().node).toBe(b1);
    }
  );

  it("A conduit's updateFunc can halt update propagation by returning undefined",
    function() {
      s2.triggerUpdate({value: 10, halt: 'a2'});
      expect(allCountsEqual(allConduits, 0)).toBe(true);
      expect(s2.getValue().value).toBe(10);
      expect(a2.getValue().value).toBe(0);

      s2.triggerUpdate({value: 20, halt: 'a3'});
      expect(a2.getValue().updateCount).toBe(1);
      expect(allCountsEqual([a3, b2], 0)).toBe(true);
      expect(a2.getValue().value).toBe(20);
      expect(a3.getValue().value).toBe(0);
      expect(b2.getValue().value).toBe(0);

      context.triggerUpdate([s2, s3],
        [{value: 0, halt: 'none'}, {value: 0, halt: 'none'}]); // flush halt signal
      context.triggerUpdate([s2, s3], [{value: 10, halt: 'a2'}, {value: 20}]);
      expect(s2.getValue().value).toBe(10);
      expect(a3.getValue().value).toBe(20);
      expect(Object.keys(a3.getValue().updateMap)).toEqual(['s3']);

      // Halted conduits still contribute their unchanged value for
      // their children's args
      context.triggerUpdate([s2, s3], [{value: 10, halt: 'a2'}, {value: -10}]);
      expect(s3.getValue().value).toBe(-10);
      expect(a3.getValue().value).toBe(0);
      expect(Object.keys(a3.getValue().updateMap)).toEqual(['s3']);
    }
  );

  it("If a conduit's updateFunc returns undefined, it won't trigger its listeners",
    function() {
      var listenerUpdates = [];
      var listener = function(value, node) {
        listenerUpdates.push(node.id);
      };
      allConduits.concat([s1, s2, s3]).forEach(function(node) {
        node.addListener(listener);
      });

      // Example with no halting
      listenerUpdates = [];
      s2.triggerUpdate({value: 0});
      expect(listenerUpdates).toEqual(['s2', 'a2', 'a3', 'b2']);

      // Example with halting a2
      listenerUpdates = [];
      s2.triggerUpdate({value: 0, halt: 'a2'});
      expect(listenerUpdates).toEqual(['s2']);
    }
  );

  it("Listeners are triggered in batch after all nodes have been updated",
    function() {
      var listenerCheck = {};
      var listener = function(value, node) {
        listenerCheck[node.id] = [s1, a1, b1, b2].every(function(node) {
          return node.getValue().value === 10;
        });
      };
      allConduits.concat([s1, s2, s3]).forEach(function(node) {
        node.addListener(listener);
      });

      s1.triggerUpdate({value: 10});
      expect(listenerCheck).toEqual({s1: true, a1: true, b1: true, b2: true});
    }
  );

  it("No further 'triggerUpdate' calls can be made until all updates are " +
    "complete and all listeners have finished",
    function() {
      b1.addListener(function(value) {
        s3.triggerUpdate({value: 0});
      });
      expect(function() { s1.triggerUpdate({value: 0}); }).toThrowError(/update/);
    }
  );

  describe("context.triggerUpdate()", function() {
    it("can be called with an array of source nodes or ids and " +
      "a corresponding array of new values",
      function() {
        expect(allCountsEqual(allConduits, 0)).toBe(true);

        context.triggerUpdate([s1, s2, s3],
          [{value: 1}, {value: 2}, {value: 3}]);
        expect(allCountsEqual(allConduits, 1)).toBe(true);
        expect(s1.getValue().value).toBe(1);
        expect(s2.getValue().value).toBe(2);
        expect(s3.getValue().value).toBe(3);

        context.triggerUpdate(['s1', 's2', 's3'],
          [{value: 10}, {value: 20}, {value: 30}]);
        expect(allCountsEqual(allConduits, 2)).toBe(true);
        expect(s1.getValue().value).toBe(10);
        expect(s2.getValue().value).toBe(20);
        expect(s3.getValue().value).toBe(30);

        // Mixing nodes and strings works too, but looks sloppy
        context.triggerUpdate([s1, 's2', s3],
          [{value: 10}, {value: 20}, {value: 30}]);
        expect(allCountsEqual(allConduits, 3)).toBe(true);
      }
    );

    it("can be called with a map from source ids to their new values",
      function() {
        expect(allCountsEqual(allConduits, 0)).toBe(true);
        context.triggerUpdate({
          s1: {value: 1}, s2: {value: 2}, s3: {value: 3}
        });
        expect(allCountsEqual(allConduits, 1)).toBe(true);
        expect(s1.getValue().value).toBe(1);
        expect(s2.getValue().value).toBe(2);
        expect(s3.getValue().value).toBe(3);
      }
    );

    it("requires 'newValues' to be an array if used as an argument",
      function() {
        expect(function() {
          context.triggerUpdate([s1, s2, s3], 'newValues not an array');
        }).toThrowError(/array/);
      }
    );

    it("enforces 'sources.length === newValues.length' when calling with arrays",
      function() {
        expect(function() {
          context.triggerUpdate([s1, s2, s3], [{value: 0}, {value: 0}]);
        }).toThrowError(/length/);
      }
    );

    it("must only specify source nodes, all from the same context",
      function() {
        // Can't directly trigger updates on conduits
        expect(function() {
          context.triggerUpdate([s1, b3], [{value: 0}, {value: 0}]);
        }).toThrowError(/source/);

        // Can't supply source nodes from other contexts
        var otherContext = reactiveflow.newContext();
        var otherSource = otherContext.newSource('otherSource', 0);
        expect(otherSource.isSource).toBe(true);
        expect(function() {
          context.triggerUpdate([s1, otherSource], [{value: 0}, {value: 0}]);
        }).toThrowError(/context/);
      }
    );
  });
});


describe("The reactiveflow version", function() {
  it("is a string property", function() {
    expect(typeof reactiveflow.version).toBe('string');
  });
});

})();
