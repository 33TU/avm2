import { Bytecode } from '../../Bytecode';
import { CompilerState } from '../CompilerState';
import { emitInlineStack } from './emitInlineVars';

export function emitDomainMemOppcodes(state: CompilerState) {
	const z = state.currentOpcode;
	const stack0 = emitInlineStack(state, 0);
	const stack1 = emitInlineStack(state, 1);
	const target = emitInlineStack(state, 0, false);
	if (z.name >= Bytecode.LI8 && z.name <= Bytecode.LF64) {
		state.popAnyAlias(target);
	}

	// Cache the stable binding, not its view: calls may resize or rebind the memory.
	state.emitMain('domainMemory = domainMemory || context.domainMemoryBinding;');

	switch (z.name) {
		//http://docs.redtamarin.com/0.4.1T124/avm2/intrinsics/memory/package.html#si32()
		case Bytecode.SI8:
			state.emitMain(`domainMemory.storage.view.setInt8(${stack0}, ${stack1});`);
			break;
		case Bytecode.SI16:
			state.emitMain(`domainMemory.storage.view.setInt16(${stack0}, ${stack1}, true);`);
			break;
		case Bytecode.SI32:
			state.emitMain(`domainMemory.storage.view.setInt32(${stack0}, ${stack1}, true);`);
			break;
		case Bytecode.SF32:
			state.emitMain(`domainMemory.storage.view.setFloat32(${stack0}, ${stack1}, true);`);
			break;
		case Bytecode.SF64:
			state.emitMain(`domainMemory.storage.view.setFloat64(${stack0}, ${stack1}, true);`);
			break;

		//http://docs.redtamarin.com/0.4.1T124/avm2/intrinsics/memory/package.html#li32()
		case Bytecode.LI8:
			state.emitMain(`${target} = domainMemory.storage.view.getUint8(${stack0});`);
			break;
		case Bytecode.LI16:
			state.emitMain(`${target} = domainMemory.storage.view.getUint16(${stack0}, true);`);
			break;
		case Bytecode.LI32:
			state.emitMain(`${target} = domainMemory.storage.view.getInt32(${stack0}, true);`);
			break;
		case Bytecode.LF32:
			state.emitMain(`${target} = domainMemory.storage.view.getFloat32(${stack0}, true);`);
			break;
		case Bytecode.LF64:
			state.emitMain(`${target} = domainMemory.storage.view.getFloat64(${stack0}, true);`);
			break;
	}
}
