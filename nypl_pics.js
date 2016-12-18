// Create a simple server to keep the bot running
var http = require('http');
http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Pictures of New York\n');
}).listen(8090);

// Require stuff
var fs = require('fs');
var Random = require('random-js');
var request = require('request');
var Twit = require('twit');
require('dotenv').config();

// Set up Random and Twit
r = new Random(Random.engines.browserCrypto);
 
var T = new Twit({
  consumer_key:         process.env.TWITTER_KEY,
  consumer_secret:      process.env.TWITTER_SECRET,
  access_token:         process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret:  process.env.TWITTER_TOKEN_SECRET,
  timeout_ms:           60*1000,  
});

// Set some variables

var alternatives = ["bird", "pants", "dress", "beer", "Australia", "hat", "France", "fight", "dance", "gentleman", "lady", "boy", "apple", "circus", "musician", "fireman", "Russia", "Rome", "urchin", "north", "south", "western", "guitar", "slums", "palace", "rich", "candy", "farm", "trash", "fish", "tokyo", "fancy"];
var stream = T.stream('user', {replies: 'all'});

stream.on('error', function(error) {
	console.log("### Twitter replies stream error ###");
	console.log(error);
})

stream.on('tweet', function(tweet){
	var text = tweet.text;
	var name = text.slice(0,13).toLowerCase();

	// only respond to @s, not mentions
	if (name === '@picturesofny') {
		var query = text.slice(14);
		var user = tweet.user.screen_name;
		// use tweet id_str (not id: they're sometimes different)
		var currentId = tweet.id_str;
		// make sure bot doesn't respond to self (to avoid an infinite loop)
		// I can't think of any reason this would happen, but just in case...
		if (user !== 'picturesofNY') {
			// respond
			getUrl(query, user);
			// update last tweet ID
			setLast(currentId);			
		};
	}
});

// ****** fallover
// whenever we (re)connect to Twitter, check for any mentions since we last responded
stream.on('connected', function(response){
	// Get the last tweet id to which we responded
	fs.readFile('lastId.txt', (err, data) => {
		if (err) {
			console.log('### Twitter reconnection error ###');
			console.log(err);
		}
		var lastTweet = data.toString();
		getMentions(lastTweet);
	});
});

function getMentions(id) {
	// create empty array
	var replies = [];
	// get mentions since the lastId
	T.get('statuses/mentions_timeline', {since_id: id, include_entities: false}, function(err, data, response) {
		if (data.length > 0) {
			for (i in data) {
				var currentId = data[i].id_str;					
				var tweet = data[i].text;
				var name = tweet.slice(0,13).toLowerCase();
				// only respond to @s, not mentions
				if (name === '@picturesofny') {
					var query = tweet.slice(14);
					var user = data[i].user.screen_name;
					// trigger a reply
					getUrl(query, user);
				};
			};
			// push every ID to an array
			replies.push(currentId);				
			// set new 'lastId' using the biggest (i.e. latest) ID
			// sort descending using a compare function 
			replies.sort(function(a,b){return b-a});
			// get biggest number
			var newId = replies[0];							
			setLast(newId);
		} else {
			console.log("no new tweets");
		}
	});
};
// ****** end fallover

function setLast(id){
	// write it to file so we're up to date if the script falls over
	fs.writeFile('lastId.txt', id);
};

function getUrl(searchTerm, user, initSearch){
console.log("got searchterm " + searchTerm + " and user " + user);
	var url = 'http://api.repo.nypl.org/api/v1/items/search?q=' + searchTerm + '&publicDomainOnly=true&per_page=50';
	request.get(url,{
		'headers': {
			 'Authorization':'Token token=' + process.env.NYPL_API_TOKEN	
			}
	}, function (error, response, body){
		if (error) {
			console.log('### error getting NYPL url ###');
			console.log(error);
		};
		 if (!error && response.statusCode == 200) {
			var parsed = JSON.parse(body);		
			var hits = parsed.nyplAPI.response.numResults;
			var pages = parsed.nyplAPI.request.totalPages;
			if (pages > 1) {
				var pn = r.integer(1,pages)
				bigSet(searchTerm, pn, user, initSearch)
			} else {
				getFile(parsed, hits, searchTerm, user, initSearch);
			}
		 };
	});
};

function bigSet(searchTerm, pn, user, initSearch) {	
	var url = 'http://api.repo.nypl.org/api/v1/items/search?q=' + searchTerm + '&publicDomainOnly=true&page=' + pn + '&per_page=50';
	request.get(url,{
		'headers': {
			 'Authorization':'Token token=' + process.env.NYPL_API_TOKEN	
			}
	}, function (error, response, body){
		if (error){
			console.log('### error retrieving large NYPL set')
			console.log(error)
		};	
		 if (!error && response.statusCode == 200) {
			var parsed = JSON.parse(body);				
			var hits = parsed.nyplAPI.response.numResults;		
			var pages = parsed.nyplAPI.request.totalPages;
			getFile(parsed, hits, searchTerm, user, initSearch);
		};
	});
};

function getFile (parsed, hits, searchTerm, user, initSearch) {
	// if we get a result, pic a random image from the returned data			
	if (hits > 0) {
		for (z in parsed.nyplAPI.response.result) {
			var itm = parsed.nyplAPI.response.result[z];				
				if (itm && itm.typeOfResource === "still image") {										
				var imageID = itm.imageID;		
				var uuid = itm.uuid;
				// build the image url for 100px square images
				// the API tells us it's always constructed like this
				var picUrl = "http://images.nypl.org/index.php?id=" + imageID + "&t=r&download=1&suffix=" + uuid + ".001"
				choosePic.add(picUrl)					
			}	
		} if (choosePic.size() != 0) {
			choosePic.choose(searchTerm, user, initSearch);
		} else {
			// if there are no results, try again, and include the initial search term as an argument
			// if there's already one listed, keep using it so we keep the actual query
			var alternative = r.pick(alternatives);
				if (initSearch) {
					getUrl(alternative, user, initSearch);	
				} else {
					getUrl(alternative, user, searchTerm);
				}
		}
	} else {
		var alternative = r.pick(alternatives);
		if (initSearch) {
				getUrl(alternative, user, initSearch);	
			} else {
				getUrl(alternative, user, searchTerm);
			}
		};
};

var choosePic = (function() {
	var array = [];
	function addItem(url){
	array.push(url)
}
	return {
		add: function(url) {
			addItem(url);
		},
		size: function(){
			return array.length;
		},
		choose: function(searchTerm, user, initSearch){
			var pic = r.pick(array);
			array = [];
			return savePic(pic, searchTerm, user, initSearch);
		}
	}						
})();


function savePic (url, searchTerm, user, initSearch) {
	var file = r.string(24) + '.jpeg';
	var picStream = request(url).pipe(fs.createWriteStream('pics/' + file, {autoClose: true}));

	// log errors
	picStream.on('error', function(error){
		console.log('#### error saving pic ####');
		console.log(error);
	});

	// when pipe ends
	picStream.on('finish', function() {sendTweet(file, searchTerm, user, initSearch)});
};

function sendTweet(file, searchTerm, user, initSearch) {

	 var image = fs.readFileSync('pics/' + file, { encoding: 'base64'});

	if (!initSearch) {
		var msg = "@" + user + " I found you the perfect picture of " + searchTerm;
	} else {
		var msg = "@" + user + " Sorry, I couldn't find a picture of " + initSearch + " so I got you a picture of " + searchTerm + ".";
	}

	// first we must post the media to Twitter 
	T.post('media/upload', { media_data: image }, function (err, data, response) {
		 if (err){
		 	console.log('### error uploading pic');
		 	console.log(err);
		 };
		// now we can reference the media and post a tweet (media will attach to the tweet) 
	 	var mediaIdStr = data.media_id_string;
		var params = { status: msg, media_ids: [mediaIdStr] }
	 
		T.post('statuses/update', params, function (err, data, response) {
		  	if (err) {
		  		console.log('### error posting to Twitter ###');
		  		console.log(error);
		  	};
		    console.log(data.text)
		    // probably should consider deleting the image file here, otherwise the disk will fill up
		    // or alternatively we could give every picture the same name, if we can do that in a way that works
	  });
	});
	image = null;		
};