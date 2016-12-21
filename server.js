// Setup
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var path = require('path');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, './static')));
app.set('views', path.join(__dirname, './views'));
app.set('view engine', 'ejs');

var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/message_board');
var Schema = mongoose.Schema;

function print(obj,depth=0,initial=depth) {
	var indent_width = initial - depth;
	var indent = '';
	for (var i = 0; i < indent_width; i++) {
		indent += '   ';
	}
	for (var key in obj) {
		console.log(indent,key,':',typeof(obj[key]) == 'function' ? '[function]' : obj[key])
		if (depth) {
			print(obj[key],depth-1,initial);
		}
	}
}

function family(obj){
	return obj.__proto__.constructor.name;
}

function Field (value_in,cond_in,error_in) {
	this.input = {
		value : value_in,
		cond  : cond_in,
		error : error_in,
	}
	if (family(cond_in) == 'RegExp') {
		if (cond_in.exec(value_in) != null){
			var valid = true;
			var value = value_in;
			var error = '';
		} else {
			var valid = false;
			var error = error_in;
		}
	} else if (family(cond_in) == 'Array'){
		var valid = true;
		var error = [];
		for (var i = 0; i < cond_in.length; i++) {
			var cond_r = cond_in[i];
			var error_r = error_in[i] ? error_in[i] : cond_in[i][1];
			if (! new Field(value_in,cond_r,error_r).valid) {
				valid = false;
				error.push(error_r)
			}
		}
	} else {
		if (cond_in) {
			var valid = true;
			var value = value_in;
			var error = '';
		} else {
			var valid = false;
			var error = error_in;
		}
	}
	this.valid = valid;
	this.value = value;
	this.error = error;
	this.vtype = family(cond_in);
}

function Form (fields) {
	this.fields = fields;
	var valid  = true;
	var data   = {};
	var errors = {};
	for (f in fields){
		if (fields[f].valid) {
			data[f] = fields[f].value;
			errors[f] = '';
		} else {
			valid = false;
			errors[f] = fields[f].error;
		}
	}
	this.valid  = valid;
	this.data   = data;
	this.errors = errors;
}

// Message Table
var MessageSchema = new mongoose.Schema({
	author: {
		type: String,
	},
	text: {
		type: String, 
	}, 
	comments: [{
		type: Schema.Types.ObjectId, 
		ref: 'Comment'
	}]
}, {timestamps: true });
mongoose.model('Message',MessageSchema);
var Message = mongoose.model('Message');

// Comment Table
var CommentSchema = new mongoose.Schema({
	author: {
		type: String,
	},
	_message: {
		type: Schema.Types.ObjectId, 
		ref: 'Message'
	},
	text: {
		type: String, 
	}
}, {timestamp: true });
mongoose.model('Comment',CommentSchema);
var Comment = mongoose.model('Comment');

var VERRORS = {m:{c:'',n:''},c:{c:'',n:''}};

app.get('/',function(request,response) {
	Message.find({})
	.populate('comments')
	.exec(function(err,data) {
		if (err) {
			response.render('error',{errors:[err]})
		} else {
			var messages = data;
			// console.log('\nFound:')
			response.render('index',{messages:data,e:VERRORS});
		}
	})
})

app.post('/message',function(request,response) {
	var form = new Form({
		author : new Field(request.body.name,/.{4,}/,'Name must contain at least 4 characters'),
		text   : new Field(request.body.message,/.+/,"You want to say something, don't you?"),
	})
	if (form.valid) {
		var new_message = new Message(form.data);
		new_message.save(function(err) {
			if (err) {
				response.render('error',{errors:err});
			} else {
				console.log('Saved:',new_message)
				response.redirect('/');
			}
		})
	} else {
		VERRORS.m.n = form.errors.author;
		VERRORS.m.c = form.errors.text;
		// PERSIST.m.n = form.fields.author.input.value;
		// PERSIST.m.c = form.fields.text.input.value;
		response.redirect('/');
	}
})

app.post('/comment',function(request,response) {
	var form = new Form({
		author   : new Field(request.body.name,/.{4,}/,'Name must contain at least 4 characters'),
		text     : new Field(request.body.comment,/.+/,"You want to say something, don't you?"),
		_message : new Field(request.body._message,true)
	})
	if (form.valid) {
		var new_comment = new Comment(form.data)
		new_comment.save(function(err) {
			if (err) {
				response.render('error',{errors:err});
			} else {
				Message.update({_id:request.body._message},{$push:{comments:new_comment}},function(err,data) {
					console.log('Errors:',err);
					console.log('Data:',data);
					console.log('\n\n\nSaved:',new_comment)
					response.redirect('/');
				});
			}
		})
	} else {
		VERRORS.c.n = form.errors.author;
		VERRORS.c.c = form.errors.text;
		response.redirect('/');
	}
})

app.get('/clear',function(request,response) {
	VERRORS = {m:{c:'',n:''},c:{c:'',n:''}};
	console.log('Error messages cleared.')
	response.redirect('/');
})

app.get('/nuke',function(request,response) {
	VERRORS = {m:{c:'',n:''},c:{c:'',n:''}};
	Comment.remove({},function(err,result) {
		if (err) {
			console.log(err);
		} else {
			Message.remove({},function(err,result) {
				if (err) {
					console.log(err);
				} else {
					console.log('\n\tRADIANCE OF A THOUSAND SUNS\n')
					response.redirect('/')
				}
			})
		}
	})
})

var port = 5000;
app.listen(port, function() {
	console.log("Running at LOCALHOST Port",port);
})