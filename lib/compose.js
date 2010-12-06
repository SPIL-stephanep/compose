/*
 * ComposeJS, object composition for JavaScript, featuring
* JavaScript-style prototype inheritance and composition, multiple inheritance, 
* mixin and traits-inspired conflict resolution and composition  
 */
"use strict";
(function(define){
define([], function(exports){
	// function for creating instances from a prototype
	function Create(){
	}
	var defineProperty = Object.defineProperty || function(object, key, descriptor){
		object[key] = descriptor.value;
	};
	function delegate(proto){
		Create.prototype = typeof proto == "function" ? proto.prototype : proto;
		return new Create();
	}
	// this does the work of combining mixins/prototypes
	function mixin(instance, args, i){
		// use prototype inheritance for first arg
		var argsLength = args.length; 
		for(; i < argsLength; i++){
			var arg = args[i];
			if(typeof arg == "function"){
				// the arg is a function, use the prototype for the properties
				arg = arg.prototype;
				for(var key in arg){
					var value = arg[key];
					if(typeof value == "function" && key in instance && value !== instance[key]){
						// we have potentially conflicting methods
						if(value == required){
							// it is a required value, and we have satisfied it
							continue;
						} 
						else if(arg.hasOwnProperty(key)){
							// if it is own property, it is considered an explicit override 
							if(!value.overrides){
								// record the override hierarchy
								value.overrides = instance[key];
							}
						}else{
							// still possible conflict, see if either value is in the other value's override chain
							var overriden = value, existing = instance[key];
							while((overriden = overriden.overrides) != existing){
								if(!overriden){
									// couldn't find existing in the provided value's override chain 
									overriden = existing;
									while((overriden = overriden.overrides) != value){
										if(!overriden){
											// couldn't find value in the provided existing's override chain
											// we have a real conflict now
											existing = function(){
												throw new Error("Conflicted method, final composer must explicitly override with correct method.");
											}
											break;
										}
									}
									// use existing, since it overrides value
									value = existing;
									break;
								}
							}
							
						}
					}
					// apply the value from this arg's property
					if(value.__redec__){
						// redecorate
						value = value.__redec__;
						value.install.call(instance, key);
						instance[key].__redec__ = value;						
					}else{
						instance[key] = value;
					}				
				}
			}else{
				// it is an object, copy properties, looking for modifiers
				for(var key in arg){
					var value = arg[key];
					if(typeof value == "object" && value){
						if(value instanceof Decorator){
							// apply modifier
							value.install.call(instance, key);
							instance[key].__redec__ = value;
						}
						else if(value.value || value.get || value.set){
							// support for ES5 property descriptors 
							defineProperty(instance, key, value);
						}else{
							// normal value
							instance[key] = value;
						}
					}else{
						if(typeof value == "function" && key in instance){
							if(value == required){
								// required requirement met
								continue;
							} 
							if(!value.overrides){
								// add the overrides chain
								value.overrides = instance[key];
							}
						}
						// add it to the instance
						instance[key] = value;
					}
				}
			}
		}
		return instance;	
	}

	// Decorator branding
	function Decorator(install){
		this.install = install;
	}
	Compose.Decorator = Decorator;
	// around and uses Decorator for calling super methods
	Compose.around = Compose.uses = function(){
		var args = arguments;
		var methodIndex = args.length - 1;
		var method = args[methodIndex];
		return new Decorator(function(key){
			if(methodIndex == 0){
				
			}
			var resolvedArgs = [];
			var missing = [];
			for(var value, i = 0; i < methodIndex; i++){
				resolvedArgs.push(value = this[args[i]]);
				if(!value){
					missing.push(args[i]);
				}
			}
			if(missing.length){
				// unresolved components, create new uses with remaining missing dependencies
				missing.push(function(){
					// find the unresolved args, and apply the newly resolved values
					for(var i = 0, mi = 0; i < resolvedArgs.length; i++){
						if(!resolvedArgs[i]){
							resolvedArgs[i] = arguments[mi++];
						}
					}
					return method.apply(this, resolvedArgs);
				});
				return Compose.uses.apply(this, missing);
			}
			return method.apply(this, resolvedArgs);
		});
	};

	// rename Decorator for calling super methods
	Compose.from = function(trait, fromKey){
		return new Decorator(function(key){
			this[key] = (typeof trait == "string" ? this[trait] : trait[fromKey || key]) || function(){
				throw new Error(fromKey + " source method was not available to be renamed to " + key);
			};
		});
	};
	// dontEnum Decorator
	Compose.dontEnum = function(value){
		return new Decorator(function(key){
			defineProperty(this, key, {
				value: value,
				enumerable: false,
				writable: true,
				configurable: true
			});
		});
	};
	// Composes an instance
	Compose.create = function(base){
		// create the instance
		var instance = mixin(delegate(base), arguments, 1);
		var argsLength = arguments.length;
		// for go through the arguments and call the constructors (with no args)
		for(var i = 0; i < argsLength; i++){
			var arg = arguments[i];
			if(typeof arg == "function"){
				instance = arg.call(instance) || instance;
			}
		}
		return instance;
	}
	// The required function, just throws an error if not overriden
	function required(){
		throw new Error("This method is required and no implementation has been provided");
	};
	Compose.required = required;
	// get the value of |this| for direct function calls for this mode (strict in ES5)
	var undefinedThis = (function(){
		return this; // this depends on strict mode
	})();
	
	// Compose a constructor
	function Compose(base){
		var args = arguments;
		var argsLength = args.length;
		if(this != undefinedThis){
			return mixin(this, arguments, 0); // if it is being applied, mixin into |this| 
		}
		var prototype = (args.length < 2 && typeof args[0] != "function") ? 
			args[0] : // if there is just a single argument object, just use that as the prototype 
			mixin(delegate(base), arguments, 1); // normally create a delegate to start with				
		function Constructor(){
			var instance;
			if(this == undefinedThis){
				// we allow for direct calls without a new operator, in this case we need to
				// create the instance ourself.
				Create.prototype = prototype;
				instance = new Create();
			}else{
				instance = this;
			}
			// call all the constructors with the given arguments
			for(var i = 0; i < argsLength; i++){
				var arg = args[i];
				if(typeof arg == "function"){
					instance = arg.apply(instance, arguments) || instance;
				}
			}
			return instance;
		}
		Constructor.prototype = prototype;
		return Constructor;
	};
	// returning the export of the module
	return Compose;
});
})(typeof define != "undefined" ?
	define: // AMD/RequireJS format if available
	function(deps, factory){
		var exports = factory(); // execute the factory
		if(typeof module !="undefined"){
			module.exports = exports; // CommonJS environment, like NodeJS
		}else{
			Compose = exports; // raw script, assign to Compose global
		}
	});