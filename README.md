# picturesofNY (v 0.2)

This is a nodejs Twitter bot that uses the [New York Public Library Digital Collections API](http://api.repo.nypl.org/#).

## Usage

To see it in action, check out [@picturesofNY](https://twitter.com/picturesofNY). Send a tweet `@picturesofNY [word or phrase]` and the bot will attempt to reply with a public domain photograph from the NYPL collection, or failing that, a random result based on a list of alternative search terms.

## Requirements

* Twitter account and app keys
* nodejs
* fs
* random-js
* request
* twit

## Change Log

### v0.2.1

Fixed bug where bot fell over if NYPL API returns an empty result.

### v0.2

Now uses the Twitter streaming API, with REST API to catch anything sent whilst the bot is disconnected for any reason.

## License

MIT (Hugh Rundle 2016)