// File: MB-Parser.js
module.exports = function(RED) {
    function ModbusParserNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        const MODE       = config.mode;        // "R" | "W"
        const DATA_TYPE  = config.dataType;
        const SWAP_WORDS = config.swapWords;
        const SWAP_BYTES = config.swapBytes;
        const DECIMALS   = config.decimals;

        const typeMap = {
            Int16:   {size:2, read:"getInt16"},
            UInt16:  {size:2, read:"getUint16"},
            Int32:   {size:4, read:"getInt32"},
            UInt32:  {size:4, read:"getUint32"},
            Float32: {size:4, read:"getFloat32"},
            Float64: {size:8, read:"getFloat64"}
        };

        function parseRegisters(regs) {
            const cfg = typeMap[DATA_TYPE];
            const per = cfg.size/2, out=[];
            for(let i=0;i<regs.length;i+=per) {
                out.push(parseValue(regs.slice(i,i+per), cfg));
            }
            return out;
        }

        function parseValue(slice, cfg) {
            const buf = new ArrayBuffer(slice.length*2),
                view = new DataView(buf);
            slice.forEach((w,i)=>{
                const idx = SWAP_WORDS ? slice.length-1-i : i;
                let val = slice[idx];
                if (SWAP_BYTES) val = ((val&0xFF)<<8)|((val>>8)&0xFF);
                view.setUint16(i*2, val, false);
            });
            let v = view[cfg.read](0, false);
            if (cfg.read.startsWith("getFloat")) v = Number(v.toFixed(DECIMALS));
            return v;
        }

        function writeValues(values) {
            const cfg = typeMap[DATA_TYPE];
            const per = cfg.size / 2;
            const out = [];
            const setFn = cfg.read.replace(/^get/, "set");

            values.forEach(val => {
                const buf = new ArrayBuffer(cfg.size);
                const view = new DataView(buf);
                view[setFn](0, val, false);

                const words = [];
                for (let i = 0; i < per; i++) {
                    let w = view.getUint16(i * 2, false);
                    if (SWAP_BYTES) w = ((w & 0xFF) << 8) | ((w >> 8) & 0xFF);
                    words.push(w);
                }

                if (SWAP_WORDS) words.reverse();

                out.push(...words);
            });

            return out;
        }


        this.on('input', function(msg) {
            try {
                if (MODE === "R") {
                    msg.payload = parseRegisters(msg.payload||[]);
                } else {
                    // assume payload is array of numbers
                    msg.payload = writeValues(msg.payload||[]);
                }
                node.send(msg);
            } catch(err) {
                node.error(err.message, msg);
            }
        });
    }
    RED.nodes.registerType("MB-Parser", ModbusParserNode);
};
