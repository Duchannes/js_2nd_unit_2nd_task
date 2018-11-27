const fs = require('fs');
const requestPromise = require('request-promise');

const yargs = require('yargs')
  .usage('$0 <cmd> [args]')
  .option('voice', {
    alias: 'v',
    describe: 'voice gender for text-to-speech translarion',
    choices: ['MALE', 'FEMALE', 'NEUTRAL'],
    default: 'MALE'
  });

// eslint-disable-next-line no-unused-expressions
yargs
  .command(
    'load <letter>',
    'Creates a .html file in the "result" folder, which contains a list of all marvel heroes, beginning with the <letter>, with a voiced description.',
    (yargs) => {
      yargs.positional('letter', {
        describe: 'The letter with which the names of the characters begin',
        type: 'string'
      });
    },
    function checkArgsAndLoad (argv) {
      if (argv.letter.length !== 1) { console.log(`Found more than one letter. will be used the first (${argv.letter[0]})`); }
      load(argv.letter[0], argv.voice);
    })
  .demandCommand(1, 'You need at least one command before moving on.')
  .help()
  .argv;

// A function that returns the search result of all characters on a specific letter from marvel API.
function load (startsWith, voice) {
  createFolders(startsWith);
  const request = {
    method: 'GET',
    uri: `http://gateway.marvel.com/v1/public/characters?nameStartsWith=${startsWith}&limit=100&ts=1&apikey=54b3af097b7338da4d03ef1594c70874&hash=41a42fc346c5d0311bcc812c8701bf51`,
    json: true
  };
  requestPromise(request)
    .then((response) => {
      console.log(`The response succesfully got.`);
      const parsedData = responseParser(response);
      toVoice(parsedData, startsWith, voice);
      createHTML(parsedData, startsWith);
    })
    .catch(function (err) {
      console.log(err);
    });
}

// The function that turns the response result into an object
function responseParser (response) {
  let data = [];
  response.data.results.forEach(character => {
    data.push({
      'id': character.id,
      'name': character.name,
      'description': character.description,
      'wiki': character.urls[0].url,
      'comics': character.urls[1].url
    });
  });
  return data;
}

// A function that creates an HTML document with information about characters starting with a specific letter.
function createHTML (data, startsWith) {
  let html;
  if (data.length) {
    html = fs.readFileSync('./templates/template.html');
    data.forEach(element => {
      const description = (element.description && element.description.length > 5) ? `<audio controls="controls"><source src="./mp3/${startsWith}/${(element.name).replace('/', ' ')}.mp3" type="audio/mpeg"></audio>` : 'none';
      html += `<td>${element.id}</td><td>${element.name}</td><td>${description}</td><td><a href="${element.wiki}">${element.name} wiki</a></td><td><a href="${element.comics}">${element.name} comics</a></td></tr>`;
    });
    html += '</table></body></html>';
  } else {
    html = fs.readFileSync('./templates/blank.html');
    html += `<td>Hero starts with ${startsWith} wasn't found</td>`;
    html += '</table></body></html>';
  }
  fs.writeFileSync(`./result/${startsWith}-Marvel_Heroes.html`, html);
  console.log(`./result/${startsWith}-Marvel_Heroes.html succesfully created.`);
}

// The function that sends a request for revision of text to speech, if there is a description of the hero
function toVoice (data, startsWith, voice) {
  data.forEach(element => {
    if (element.description && element.description.length > 5) {
      const body = {
        input: { text: element.description },
        voice: {
          languageCode: 'en-US',
          ssmlGender: voice
        },
        audioConfig: {
          audioEncoding: 'MP3'
        }
      };
      const request = {
        method: 'POST',
        uri: 'https://texttospeech.googleapis.com/v1beta1/text:synthesize',
        headers: {
          'X-Goog-Api-Key': 'AIzaSyAPVk0DS7FnUqA5PSWRMl85TRT9OeMZYLE'
        },
        body: JSON.stringify(body)
      };
      textToSpeech(request, element.name, startsWith);
    }
  });
}

// Text-to-speech function using google api service by creating request
function textToSpeech (request, name, startsWith) {
  name = name.replace('/', ' ');
  requestPromise(request)
    .then((response) => {
      const b64string = JSON.parse(response).audioContent;
      const buf = Buffer.from(b64string, 'base64');
      fs.writeFileSync(`./result/mp3/${startsWith}/${name}.mp3`, buf, 'binary', err => {
        if (err) {
          throw err;
        }
      });
      console.log(`./result/mp3/${startsWith}/${name}.mp3 succesfully created.`);
    })
    .catch(function (err) {
      throw err;
    });
}

// A function that checks for the existence of folders for the result.
function createFolders (startsWith) {
  if (!(fs.existsSync('./result/'))) {
    fs.mkdirSync('./result/');
  }
  if (!(fs.existsSync('./result/mp3/'))) {
    fs.mkdirSync('./result/mp3/');
  }
  if (!(fs.existsSync('./result/mp3/' + startsWith))) {
    fs.mkdirSync('./result/mp3/' + startsWith);
  }
}
