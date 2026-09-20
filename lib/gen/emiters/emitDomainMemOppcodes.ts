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

	// Calls between memory operations can replace or grow the backing ByteArray.
	state.emitMain('domainMemory = context.domainMemory;');

	switch (z.name) {
		//http://docs.redtamarin.com/0.4.1T124/avm2/intrinsics/memory/package.html#si32()
		case Bytecode.SI8:
			state.emitMain(`domainMemory.setInt8(${stack0}, ${stack1});`);
			break;
		case Bytecode.SI16:
			state.emitMain(`domainMemory.setInt16(${stack0}, ${stack1}, true);`);
			break;
		case Bytecode.SI32:
			state.emitMain(`domainMemory.setInt32(${stack0}, ${stack1}, true);`);
			break;
		case Bytecode.SF32:
			state.emitMain(`domainMemory.setFloat32(${stack0}, ${stack1}, true);`);
			break;
		case Bytecode.SF64:
			state.emitMain(`domainMemory.setFloat64(${stack0}, ${stack1}, true);`);
			break;

		//http://docs.redtamarin.com/0.4.1T124/avm2/intrinsics/memory/package.html#li32()
		case Bytecode.LI8:
			state.emitMain(`${target} = domainMemory.getUint8(${stack0});`);
			break;
		case Bytecode.LI16:
			state.emitMain(`${target} = domainMemory.getUint16(${stack0}, true);`);
			break;
		case Bytecode.LI32:
			state.emitMain(`${target} = domainMemory.getInt32(${stack0}, true);`);
			break;
		case Bytecode.LF32:
			state.emitMain(`${target} = domainMemory.getFloat32(${stack0}, true);`);
			break;
		case Bytecode.LF64:
			state.emitMain(`${target} = domainMemory.getFloat64(${stack0}, true);`);
			break;
	}
}
