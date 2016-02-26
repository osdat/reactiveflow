
// UMD boilerplate from https://github.com/umdjs/umd - "commonjsStrict.js" template
;(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(['exports'], factory);
  } else if (typeof exports === 'object' && typeof exports.nodeName !== 'string') {
    // CommonJS
    factory(exports);
  } else {
    // Browser globals
    factory((root.reactiveflow = {}));
  }
}(this, function (exports) {
  "use strict";

  var reactiveflow = exports;

  reactiveflow.version = '0.1.1';


  /* ==========================================================================
   * Define prototypes (instead of constructor functions)
   */

  var contextProto = reactiveflow._contextProto = {};
  var nodeProto = reactiveflow._nodeProto = {};
  var sourceProto = reactiveflow._sourceProto = Object.create(nodeProto);
  var conduitProto = reactiveflow._conduitProto = Object.create(nodeProto);

  // Enumeration for node update status
  var Status = {
    CLEAN: 'CLEAN',     // default status
    REACHABLE: 'REACHABLE',   // triggerable descendant of the updating sources
    DIRTY: 'DIRTY',     // node marked to require an update
    UPDATED: 'UPDATED'  // status after a DIRTY node has been updated
  };

  // Enumeration for topological sort bookkeeping
  var Topo = {
    NONE: 'NONE',   // unvisited node
    TEMP: 'TEMP',   // preliminary mark to detect cycles
    ADDED: 'ADDED'  // node already added to sorted list
  };


  /* ==========================================================================
   * Implement reactive contexts
   */

  reactiveflow.newContext = function() {
    var context = Object.create(contextProto, {
      nodes: readOnlyEnumProp(Object.create(null))
    });
    context._isLocked = false;
    return context;
  };

  contextProto.hasId = function(id) {
    return (id in this.nodes);
  };

  contextProto.newSource = function(id, initVal) {
    if (!isString(id)) {
      throw new Error('"id" argument must be a string');
    }
    if (this.hasId(id)) {
      throw new Error('id collision: "' + id + '" already defined');
    }

    var source = Object.create(sourceProto);
    source._initNode(id, this, initVal);
    Object.defineProperty(this.nodes, id, readOnlyEnumProp(source));
    return source;
  };

  var VALID_CONFIG_KEYS = ['args', 'pArgs', 'initVal'];

  contextProto.newConduit = function(id, configOpts, updateFunc) {
    // Validate arguments
    if (!isString(id)) {
      throw new Error('"id" argument must be a string');
    }
    if (this.hasId(id)) {
      throw new Error('id collision: "' + id + '" already defined');
    }
    if (Object.prototype.toString.call(updateFunc) !== '[object Function]') {
      throw new Error('"updateFunc" argument must be a function');
    }

    if (configOpts === null || typeof configOpts !== 'object') {
      throw new Error('"configOpts" must be an object');
    }
    var keys = Object.keys(configOpts);
    if (keys.indexOf('args') === -1) {
      throw new Error('"configOpts" must have "args" property defined');
    }
    var unrecognized = keys.filter(function(key) {
      return VALID_CONFIG_KEYS.indexOf(key) === -1;
    });
    if (unrecognized.length > 0) {
      throw new Error('1 or more invalid "configOpts" properties: "' +
        unrecognized.join('", "') + '"');
    }

    // Parse and validate args/pArgs in configOpts
    var args = this._parseConfigOptArgs(configOpts.args);
    var pArgs = this._parseConfigOptArgs(configOpts.pArgs);
    var allArgs = Object.create(null);  // merge args and pArgs
    var allIds = Object.create(null);  // track duplicate nodes by unique ids
    var mergeArgs = function(newArgs) {
      for (var alias in newArgs) {
        var node = newArgs[alias];
        if (alias in allArgs) {
          throw new Error('invalid args/pArgs in configOpts: ' +
            'duplicate alias/id found: "' + alias + '"');
        }
        if (node.id in allIds) {
          throw new Error('invalid args/pArgs in configOpts: ' +
            'more than 1 reference to node with id "' + node.id + '"');
        }
        allArgs[alias] = node;
        allIds[node.id] = node;
      }
    };
    mergeArgs(args);
    mergeArgs(pArgs);

    // Construct conduit
    var conduit = Object.create(conduitProto);
    conduit._initNode(id, this, configOpts.initVal);
    Object.defineProperty(this.nodes, id, readOnlyEnumProp(conduit));
    conduit._args = args;
    conduit._pArgs = pArgs;
    conduit._updateFunc = updateFunc;

    // Register as child of args and passive child of pArgs
    for (var argId in args) {
      args[argId]._children.push(conduit);
    }
    for (var pArgId in pArgs) {
      pArgs[pArgId]._pChildren.push(conduit);
    }

    // Call updateFunc if initVal was undefined
    if (typeof conduit._value === 'undefined') {
      conduit._value = conduit._calculateUpdateValue();
    }

    return conduit;
  };

  /*
   * Helper that parses the args or pArgs specified in 'configOpts' in
   * a call to context.newConduit().  Throws an error for invalid args
   * specifications; otherwise returns a map from alias ids to nodes.
   * This method will check for alias id collisions, but not duplicate
   * node references.
   */
  contextProto._parseConfigOptArgs = function(args) {
    var _this = this;
    var result = Object.create(null);
    if (typeof args === 'undefined') {
      return result;
    }
    if (!Array.isArray(args)) {
      args = [args];
    }
    args.forEach(function(arg) {
      var wrappedArg;
      if (nodeProto.isPrototypeOf(arg)) {
        wrappedArg = {};
        wrappedArg[arg.id] = arg;
        arg = wrappedArg;
      } else if (isString(arg)) {
        if (!_this.hasId(arg)) {
          throw new Error('invalid args/pArgs in configOpts: ' +
            'context does not have id: "' + arg + '"');
        }
        wrappedArg = {};
        wrappedArg[arg] = _this.nodes[arg];
        arg = wrappedArg;
      }
      var aliases = getOwnEnumPropNames(arg);
      aliases.forEach(function(alias) {
        if (alias in result) {
          throw new Error('invalid args/pArgs in configOpts: ' +
            'duplicate alias/id found: "' + alias + '"');
        }
        var node = arg[alias];
        if (isString(node)) {
          if (!_this.hasId(node)) {
            throw new Error('invalid args/pArgs in configOpts: ' +
              'context does not have id: "' + node + '"');
          }
          node = _this.nodes[node];
        } else if (!nodeProto.isPrototypeOf(node)) {
          throw new Error('invalid args/pArgs in configOpts: ' +
            'expected a node object but found "' +
            node.toString() + '" instead');
        }
        if (node.context !== _this) {
          throw new Error('invalid args/pArgs in configOpts: ' +
            'node with id "' + node.id +
            '" is in the wrong context to add as a dependency');
        }
        result[alias] = node;
      });
    });
    return result;
  };

  contextProto.triggerUpdate = function(sources, newValues) {
    // Ensure context isn't already locked
    if (this._isLocked) {
      this._resetUpdateState();
      throw new Error('cannot trigger a nested update when an update ' +
        'is in progress for this context');
    }

    // Validate arguments and standardize sources and newValues
    var i;
    if (!Array.isArray(newValues)) {
      if (typeof newValues !== 'undefined') {
        throw new Error('"newValues" argument must be an array if used');
      }
      if (sources === null || typeof sources !== 'object' ||
        Array.isArray(sources)) {
        throw new Error('"sources" must be an object (not array) if ' +
          '"triggerUpdate" is not called with a "newValues" array');
      }
      var sourceMap = sources;
      sources = [];
      newValues = [];
      getOwnEnumPropNames(sourceMap).forEach(function(id) {
        sources.push(id);
        newValues.push(sourceMap[id]);
      });
    }
    if (sources.length !== newValues.length) {
      throw new Error('"sources" array and "newValues" array must have ' +
        'the same length');
    } else {
      // Standardize "sources" to be an array of nodes
      sources = sources.slice();  // defensive copy
      for (i = 0; i < sources.length; i++) {
        if (isString(sources[i])) {
          if (!this.hasId(sources[i])) {
            throw new Error('unrecognized source id "' + sources[i] + '"');
          }
          sources[i] = this.nodes[sources[i]];
        }
        if (!sources[i].isSource) {
          throw new Error('"' + sources[i].id + '" is not a valid source node');
        }
        if (sources[i].context !== this) {
          throw new Error('source "' + sources[i].id + '" is in the wrong ' +
            'context');
        }
      }
    }

    // Lock context to prevent unmanaged updates
    this._isLocked = true;

    // Wrap all update logic in try/catch to reset internal state before
    // rethrowing any exceptions
    try {
      // Set new values for all updating sources
      for (i = 0; i < sources.length; i++) {
        sources[i]._value = newValues[i];
      }

      // Walk non-passive children to mark update candidates
      var reachable = markReachableNodes(sources);

      // Perform topological sort on update candidates (including passive links)
      var topoArray = topologicalSort(sources);
      // Sanity check topoArray length
      if (reachable.length !== topoArray.length) {
        throw new Error('Unexpected internal error: reachable node count (' +
          reachable.length + ') different from toposort array length (' +
          topoArray.length + ')');
      }

      // Update each dirty conduit, marking children dirty along the way
      topoArray.forEach(function(node) {
        if (node.isSource) {
          node._markAsUpdated();  // marks children dirty also
        } else if (node._status === Status.DIRTY) {
          var newValue = node._calculateUpdateValue();
          if (typeof newValue !== 'undefined') {
            node._value = newValue;
            node._markAsUpdated();  // marks children dirty also
          }
        }
      });

      // Trigger listeners for all updated nodes
      topoArray.forEach(function(node) {
        if (node._status === Status.UPDATED) {
          node._triggerListeners();
        }
      });

      // Mark all nodes clean and unlock context
      topoArray.forEach(function(node) {
        node._topo = Topo.NONE;
        node._status = Status.CLEAN;
      });
      this._isLocked = false;

    } catch(e) {
      this._resetUpdateState();
      throw e;
    }
  };

  /*
   * Private helper for resetting context._isLocked and every
   * node's _status and _topo bookkeeping marks.
   */
  contextProto._resetUpdateState = function() {
    this._isLocked = false;
    for (var id in this.nodes) {
      var node = this.nodes[id];
      node._status = Status.CLEAN;
      node._topo = Topo.NONE;
    }
  };

  /*
   * Private helper for recursively marking all nodes reachable by non-passive
   * child links starting from the given array of nodes.
   * Returns an array of all such reachable nodes.
   */
  function markReachableNodes(nodes) {
    var reachable = [];
    nodes.forEach(function(node) {
      if (node._status === Status.REACHABLE) {
        return;
      }
      node._status = Status.REACHABLE;
      reachable.push(node);
      Array.prototype.push.apply(reachable, markReachableNodes(node._children));
    });
    return reachable;
  }

  /*
   * Private helper for topologically sorting all nodes marked
   * Status.REACHABLE starting with the passed in nodes.
   * Both non-passive and passive children are considered in the sort order.
   * Returns a topologically sorted array of nodes.
   */
  function topologicalSort(nodes) {
    var result = [];
    nodes.forEach(function(node) {
      toposortDfs(node, result);
    });
    result.reverse();
    return result;
  }

  /*
   * Private helper for recursive depth-first search topological sort.
   * The 'topoArrRev' argument is a running array of reverse-sorted nodes.
   * https://en.wikipedia.org/wiki/Topological_sorting#Depth-first_search
   */
  function toposortDfs(node, topoArrRev) {
    if (node._topo === Topo.TEMP) {
      throw new Error('Unexpected internal error: cycle found during ' +
        'topological sort of node "' + node.id + '"');
    }
    if (node._status !== Status.REACHABLE || node._topo === Topo.ADDED) {
      return;
    }
    node._topo = Topo.TEMP;
    node._children.concat(node._pChildren).forEach(function(child) {
      toposortDfs(child, topoArrRev);
    });
    node._topo = Topo.ADDED;
    topoArrRev.push(node);
  }


  /* ==========================================================================
   * Implement reactive nodes
   */

  nodeProto.isSource = false;
  nodeProto.isConduit = false;

  nodeProto._initNode = function(id, context, initVal) {
    Object.defineProperties(this, {
      // unique string id of node within context
      id: readOnlyEnumProp(id),
      // context this node is associated with
      context: readOnlyEnumProp(context)
    });
    // current value of node
    this._value = initVal;
    // array of child nodes triggered by an update of this node
    this._children = [];
    // array of child nodes that have this node as a passive argument
    this._pChildren = [];
    // array of listeners to call after a value update
    this._listeners = [];
    // internal status for update/dirty tracking
    this._status = Status.CLEAN;
    // internal mark for topological sort
    this._topo = Topo.NONE;
  };

  nodeProto.getValue = function() {
    return this._value;
  };

  nodeProto.addListener = function(listener) {
    this._listeners.push(listener);
  };

  nodeProto.removeListener = function(listener) {
    var index = this._listeners.indexOf(listener);
    if (index !== -1) {
      this._listeners.splice(index, 1);
    }
  };

  nodeProto.removeAllListeners = function() {
    this._listeners = [];
  };

  nodeProto.listenerCount = function() {
    return this._listeners.length;
  };

  /*
   * Private helper for marking a node as updated and marking all
   * non-passive children as dirty
   */
  nodeProto._markAsUpdated = function() {
    this._status = Status.UPDATED;
    this._children.forEach(function(child) {
      child._status = Status.DIRTY;
    });
  };

  /*
   * Private helper for triggering all listeners
   */
  nodeProto._triggerListeners = function() {
    var value = this._value;
    var node = this;
    this._listeners.forEach(function(listener) {
      listener(value, node);
    });
  };


  /* ==========================================================================
   * Implement sources
   */

  sourceProto.isSource = true;

  sourceProto.triggerUpdate = function(newValue) {
    this.context.triggerUpdate([this], [newValue]);
  };


  /* ==========================================================================
   * Implement conduits
   */

  conduitProto.isConduit = true;

  conduitProto._calculateUpdateValue = function() {
    var args = Object.create(null);
    var updateMap = Object.create(null);
    var alias;
    for (alias in this._args) {
      var argNode = this._args[alias];
      args[alias] = argNode.getValue();
      if (argNode._status === Status.UPDATED) {
        updateMap[alias] = argNode;
      }
    }
    for (alias in this._pArgs) {
      args[alias] = this._pArgs[alias].getValue();
    }
    return this._updateFunc(args, this._value, updateMap, this);
  };


  /* ==========================================================================
   * Define private helper functions
   */

  function readOnlyEnumProp(value) {
    return {
      enumerable: true,
      configurable: false,
      writable: false,
      value: value
    };
  }

  function isString(obj) {
    return Object.prototype.toString.call(obj) === '[object String]';
  }

  function getOwnEnumPropNames(obj) {
    return Object.keys(obj).filter(function(key) {
      return obj.hasOwnProperty(key);
    });
  }

}));
