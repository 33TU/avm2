import { MethodTraitInfo } from './MethodTraitInfo';
import { Scope } from '../../run/Scope';
import { ScriptInfo } from './ScriptInfo';
import { METHOD } from './METHOD';
import { createGlobalNative } from './createGlobalNative';
import { flashlog, release } from '@awayfl/swf-loader';
import { interpret } from '../../int';
import { getNative } from '../../nat/getNative';
import { getMethodOrAccessorNative } from '../../nat/getMethodOrAccessorNative';
import { assert } from '@awayjs/graphics';
import { Settings } from '../../Settings';
import { COMPILATION_STATE } from '../../flags';
import { MethodInfo } from './MethodInfo';

// A method compiled on its first call. About 88 percent of compiled methods
// never ran in an AQW session. On the first call the stub compiles the method
// and replaces itself on the prototype that holds it, so later calls reach the
// compiled function directly (a permanent forwarding stub cost 5 to 9 percent
// on hot AS3 code). Method closures are cached per receiver by name and keep
// working through the stub, so listener identity is unaffected; any other
// holder of the stub keeps forwarding.
function lazyMethod(methodInfo: MethodInfo, scope: Scope, key: string): Function {
	let compiled: Function = null;
	const stub = function (this: any) {
		if (!compiled) {
			compiled = interpret(methodInfo, scope, null);
			(<any>compiled).methodInfo = methodInfo;
		}
		for (let holder = this; holder; holder = Object.getPrototypeOf(holder)) {
			const desc = Object.getOwnPropertyDescriptor(holder, key);
			if (!desc) continue;
			if (desc.value === stub) desc.value = compiled;
			else if (desc.get === stub) desc.get = <any>compiled;
			else if (desc.set === stub) desc.set = <any>compiled;
			else break;
			Object.defineProperty(holder, key, desc);
			break;
		}
		return compiled.apply(this, arguments);
	};
	return stub;
}

export function createMethodForTrait(
	methodTraitInfo: MethodTraitInfo,
	scope: Scope,
	forceNativeMethods: boolean = false
) {
	if (methodTraitInfo.method) {
		return methodTraitInfo.method;
	}
	const methodInfo = methodTraitInfo.methodInfo;
	let method;
	if (methodInfo.flags & METHOD.Native) {
		const metadata = methodInfo.getNativeMetadata();
		if (metadata || methodTraitInfo.holder instanceof ScriptInfo) {
			if (metadata) {
				method = getNative(metadata.values[0]);
			} else {
				const mn = methodTraitInfo.multiname;
				method = getNative(mn.uri + '.' + mn.name);
			}
			method = createGlobalNative(method, scope.object.sec);
		} else {
			method = getMethodOrAccessorNative(methodTraitInfo);
		}
		if (method && !release) {
			method.toString = function () {
				return 'Native ' + methodTraitInfo.toString();
			};
			method.isInterpreted = false;
		}
	} else {
		if (forceNativeMethods)
			method = getMethodOrAccessorNative(methodTraitInfo, false);
		if (!method) {
			method = Settings.LAZY_METHOD_COMPILE && methodInfo.state === COMPILATION_STATE.PENDING
				? lazyMethod(methodInfo, scope, methodTraitInfo.multiname.getMangledName())
				: interpret(methodInfo, scope, null);

			if (!release) {
				method.toString = function () {
					return 'Interpreted ' + methodTraitInfo.toString();
				};
				method.isInterpreted = true;
			}
		}
	}
	if (!release && flashlog && methodInfo.trait) {
		method = (function (wrapped, methodInfo) {
			const traceMsg = methodInfo.toFlashlogString();
			const result: any = function () {
				flashlog.writeAS3Trace(traceMsg);
				return wrapped.apply(this, arguments);
			};
			result.toString = wrapped.toString;
			result.isInterpreted = wrapped.isInterpreted;
			return result;
		})(method, methodInfo);
	}

	assert(method, 'Not found method:' + methodTraitInfo.toString());

	methodTraitInfo.method = method;
	method.methodInfo = methodInfo;
	if (!release) {
		try {
			Object.defineProperty(method, 'name', { value: methodInfo.name });
		} catch (e) {
			// Ignore errors in browsers that don't allow overriding Function#length;
		}
	}
	method.methodInfo = methodInfo;
	return method;
}