!function(t,e){"function"==typeof define&&define.amd?define(["exports"],e):e("object"==typeof exports&&"string"!=typeof exports.nodeName?exports:t.reactiveflow={})}(this,function(t){"use strict";function e(t){var r=[];return t.forEach(function(t){t._status!==h.REACHABLE&&(t._status=h.REACHABLE,r.push(t),Array.prototype.push.apply(r,e(t._children)))}),r}function r(t){var e=[];return t.forEach(function(t){n(t,e)}),e.reverse(),e}function n(t,e){if(t._topo===l.TEMP)throw new Error("Unexpected internal error: cycle found during "+'topological sort of node "'+t.id+'"');t._status===h.REACHABLE&&t._topo!==l.ADDED&&(t._topo=l.TEMP,t._children.concat(t._pChildren).forEach(function(t){n(t,e)}),t._topo=l.ADDED,e.push(t))}function i(t){return{enumerable:!0,configurable:!1,writable:!1,value:t}}function o(t){return"[object String]"===Object.prototype.toString.call(t)}function s(t){return Object.keys(t).filter(function(e){return t.hasOwnProperty(e)})}var a=t,c=a._contextProto={},u=a._nodeProto={},f=a._sourceProto=Object.create(u),d=a._conduitProto=Object.create(u),h={CLEAN:"CLEAN",REACHABLE:"REACHABLE",DIRTY:"DIRTY",UPDATED:"UPDATED"},l={NONE:"NONE",TEMP:"TEMP",ADDED:"ADDED"};a.newContext=function(){var t=Object.create(c,{nodes:i(Object.create(null))});return t._isLocked=!1,t},c.hasId=function(t){return t in this.nodes},c.newSource=function(t,e){if(!o(t))throw new Error('"id" argument must be a string');if(this.hasId(t))throw new Error('id collision: "'+t+'" already defined');var r=Object.create(f);return r._initNode(t,this,e),Object.defineProperty(this.nodes,t,i(r)),r};var p=["args","pArgs","initVal"];c.newConduit=function(t,e,r){if(!o(t))throw new Error('"id" argument must be a string');if(this.hasId(t))throw new Error('id collision: "'+t+'" already defined');if("[object Function]"!==Object.prototype.toString.call(r))throw new Error('"updateFunc" argument must be a function');if(null===e||"object"!=typeof e)throw new Error('"configOpts" must be an object');var n=Object.keys(e);if(n.indexOf("args")===-1)throw new Error('"configOpts" must have "args" property defined');var s=n.filter(function(t){return p.indexOf(t)===-1});if(s.length>0)throw new Error('1 or more invalid "configOpts" properties: "'+s.join('", "')+'"');var a=this._parseConfigOptArgs(e.args),c=this._parseConfigOptArgs(e.pArgs),u=Object.create(null),f=Object.create(null),h=function(t){for(var e in t){var r=t[e];if(e in u)throw new Error("invalid args/pArgs in configOpts: "+'duplicate alias/id found: "'+e+'"');if(r.id in f)throw new Error("invalid args/pArgs in configOpts: "+'more than 1 reference to node with id "'+r.id+'"');u[e]=r,f[r.id]=r}};h(a),h(c);var l=Object.create(d);l._initNode(t,this,e.initVal),Object.defineProperty(this.nodes,t,i(l)),l._args=a,l._pArgs=c,l._updateFunc=r;for(var g in a)a[g]._children.push(l);for(var _ in c)c[_]._pChildren.push(l);return"undefined"==typeof l._value&&(l._value=l._calculateUpdateValue()),l},c._parseConfigOptArgs=function(t){var e=this,r=Object.create(null);return"undefined"==typeof t?r:(Array.isArray(t)||(t=[t]),t.forEach(function(t){var n;if(u.isPrototypeOf(t))n={},n[t.id]=t,t=n;else if(o(t)){if(!e.hasId(t))throw new Error("invalid args/pArgs in configOpts: "+'context does not have id: "'+t+'"');n={},n[t]=e.nodes[t],t=n}var i=s(t);i.forEach(function(n){if(n in r)throw new Error("invalid args/pArgs in configOpts: "+'duplicate alias/id found: "'+n+'"');var i=t[n];if(o(i)){if(!e.hasId(i))throw new Error("invalid args/pArgs in configOpts: "+'context does not have id: "'+i+'"');i=e.nodes[i]}else if(!u.isPrototypeOf(i))throw new Error("invalid args/pArgs in configOpts: "+'expected a node object but found "'+i.toString()+'" instead');if(i.context!==e)throw new Error("invalid args/pArgs in configOpts: "+'node with id "'+i.id+'" is in the wrong context to add as a dependency');r[n]=i})}),r)},c.triggerUpdate=function(t,n){if(this._isLocked)throw this._resetUpdateState(),new Error("cannot trigger a nested update when an update "+"is in progress for this context");var i;if(!Array.isArray(n)){if("undefined"!=typeof n)throw new Error('"newValues" argument must be an array if used');if(null===t||"object"!=typeof t||Array.isArray(t))throw new Error('"sources" must be an object (not array) if '+'"triggerUpdate" is not called with a "newValues" array');var a=t;t=[],n=[],s(a).forEach(function(e){t.push(e),n.push(a[e])})}if(t.length!==n.length)throw new Error('"sources" array and "newValues" array must have '+"the same length");for(t=t.slice(),i=0;i<t.length;i++){if(o(t[i])){if(!this.hasId(t[i]))throw new Error('unrecognized source id "'+t[i]+'"');t[i]=this.nodes[t[i]]}if(!t[i].isSource)throw new Error('"'+t[i].id+'" is not a valid source node');if(t[i].context!==this)throw new Error('source "'+t[i].id+'" is in the wrong '+"context")}this._isLocked=!0;try{for(i=0;i<t.length;i++)t[i]._value=n[i];var c=e(t),u=r(t);if(c.length!==u.length)throw new Error("Unexpected internal error: reachable node count ("+c.length+") different from toposort array length ("+u.length+")");u.forEach(function(t){if(t.isSource)t._markAsUpdated();else if(t._status===h.DIRTY){var e=t._calculateUpdateValue();"undefined"!=typeof e&&(t._value=e,t._markAsUpdated())}}),u.forEach(function(t){t._status===h.UPDATED&&t._triggerListeners()}),u.forEach(function(t){t._topo=l.NONE,t._status=h.CLEAN}),this._isLocked=!1}catch(f){throw this._resetUpdateState(),f}},c._resetUpdateState=function(){this._isLocked=!1;for(var t in this.nodes){var e=this.nodes[t];e._status=h.CLEAN,e._topo=l.NONE}},u.isSource=!1,u.isConduit=!1,u._initNode=function(t,e,r){Object.defineProperties(this,{id:i(t),context:i(e)}),this._value=r,this._children=[],this._pChildren=[],this._listeners=[],this._status=h.CLEAN,this._topo=l.NONE},u.getValue=function(){return this._value},u.addListener=function(t){this._listeners.push(t)},u.removeListener=function(t){var e=this._listeners.indexOf(t);e!==-1&&this._listeners.splice(e,1)},u.removeAllListeners=function(){this._listeners=[]},u.listenerCount=function(){return this._listeners.length},u._markAsUpdated=function(){this._status=h.UPDATED,this._children.forEach(function(t){t._status=h.DIRTY})},u._triggerListeners=function(){var t=this._value,e=this;this._listeners.forEach(function(r){r(t,e)})},f.isSource=!0,f.triggerUpdate=function(t){this.context.triggerUpdate([this],[t])},d.isConduit=!0,d._calculateUpdateValue=function(){var t,e=Object.create(null),r=Object.create(null);for(t in this._args){var n=this._args[t];e[t]=n.getValue(),n._status===h.UPDATED&&(r[t]=n)}for(t in this._pArgs)e[t]=this._pArgs[t].getValue();return this._updateFunc(e,this._value,r,this)}});
//# sourceMappingURL=reactiveflow-min.map