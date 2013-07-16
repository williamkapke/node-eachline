

var stream = require('stream');
var Transform = stream.Transform;
var Readable = stream.Readable;

function str(s){
	return typeof s === "string";
}
function sniffer(args){
	return function(){
		if(arguments.length!==args.length)
			return false;

		for(var i=0;i<args.length;i++){
			var type = arguments[i];
			var arg = args[i];
			if(str(type)){
				if(typeof arg !== type){
					return false;
				}
			}
			else if(!(arg instanceof type))
				return false;
		}
		return true;
	}
}

function eachline(a,b,c){
	var sniff = sniffer(arguments);
	var t = new Transformer();
	debugger;
	//stream.pipe(eachline(transformer)).pipe(stdio)
	if(sniff("function")){
		t.encoding = "utf8";
		t.ondata = a;
		return t;
	}
	//stream.pipe(eachline("hex", transformer)).pipe(stdio)
	else if(sniff("string", "function") || sniff("string")){
		t.encoding = a;
		t.ondata = b;
		return t;
	}
	//eachline(stream, ondata);
	else if(sniff(Readable, "function") || sniff(Readable)){
		t.encoding = "utf8";
		t.ondata = b;
		return a.pipe(t).pipe(new Dummy());
	}
	//eachline(stream, "hex", ondata);
	else if(sniff(Readable, "string", "function") || sniff(Readable, "string")){
		t.encoding = b;
		t.ondata = c;
		return a.pipe(t).pipe(new Dummy());
	}
	else {
		throw new Errow("I don't know what you want");
	}

	return t;
};
module.exports = eachline;
module.exports.in = function(location, cb){
	var args = Array.prototype.slice.call(arguments);
	var web = /(https?):\/\//.exec(location);
	if(web){
		location = require('url').parse(location);
		location.agent = false;
		require(web[1]).get(location, function(res){
			args[0] = res;
			eachline.apply(this, args);
		})
			.end();
	}
	else {
		args[0] = require('fs').createReadStream(location);
		eachline.apply(this, args);
	}
}



//a dummy writer is needed if we're not pipe'in
function Dummy(){
	stream.Writable.call(this);
}
Dummy.prototype = Object.create(stream.Writable.prototype, { constructor: { value: Dummy }});
Dummy.prototype._write = function(line, encoding, done) {
	done();
};




function Transformer() {
	Transform.call(this);
}
Transformer.prototype = Object.create(Transform.prototype, { constructor: { value: Transformer }});
module.exports.Transformer = Transformer;

function findEOL(bytes, i){
	for(;i<bytes.length;i++){
		var c = bytes[i];
		if(c===13 || c===10){ //CR or LF
			return i;
		}
	}
	return false;
}
Transformer.prototype._transform = function(chunk, encoding, done) {
	var start = 0,
		enc = !/binary|buffer/.test(this.encoding)? this.encoding : false,
		eol;

	while((eol=findEOL(chunk, start))!==false){
		var line, hasCRLF = chunk[eol]===13 && chunk[eol+1]===10;
		if(this.remnant){
			line = Buffer.concat([this.remnant, chunk.slice(start, eol)]);
			delete this.remnant;
		}
		else {
			line = chunk.slice(start, eol);
		}
		start = eol+(hasCRLF? 2:1);
		if(this.ondata)
			line = this.ondata(enc? line.toString(enc) : line);
		this.push(line, this.encoding);
	}

	if(this.remnant){//no LF found in this chunk
		this.remnant = Buffer.concat([this.remnant, chunk]);;
	}
	else {
		this.remnant = chunk.slice(start);
	}

	done();
};

Transformer.prototype._flush = function(done) {
	if(!this.remnant) return;
	var line = this.encoding && !/binary|buffer/.test(this.encoding)? this.remnant.toString(this.encoding) : this.remnant;
	if(this.ondata)
		line = 	this.ondata(line);

	this.push(line, this.encoding);
	done();
};
