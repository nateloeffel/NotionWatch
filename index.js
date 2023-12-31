// Imports
const { Client } = require("@notionhq/client");
const dotenv = require('dotenv').config()
const client = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_AUTH);
const fs = require('fs');
const path = require('path');
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


// Constants
const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});
const chemistryid = "db07dcfa-9a94-4279-93ea-5b32691be978";
const humanid = "21d456da-f639-4619-b579-96668d20b68d";
const notesdb = "0c2965f05cfb4ad4839ec9b675df13bf"

// Functions
const checkAssignments = async () => {
  const response = await notion.databases.query({ database_id: "1a57b0b38ba14b33a01bdcfd50d0ab1a" });

  response.results.forEach(async (result) => {
    const days_left = result.properties['Days Left'].formula.string;
    const title = result.properties.Name.title[0].plain_text;

    if (days_left === "1 days") {
      await notifySms(title);
      console.log(`Assignment: ${title} is due soon.`);
    }
  });
};

async function readFilesFromDirectory(directory) {
  let content = '';

  // Read the names of all files in the directory
  const fileNames = fs.readdirSync(directory);

  // Loop over each file
  for (const fileName of fileNames) {
    // Construct the full file path
    const filePath = path.join(directory, fileName);

    // Parse the file path to get the title (file name without extension)
    const title = path.parse(filePath).name;

    // Read the content of the file
    const fileContent = fs.readFileSync(filePath, 'utf8');

    // Add the title and file content to the content variable
    content += `Title: ${title}\n${fileContent}\n\n`; // adding a newline to separate content of files
  }

  return content;
}

const notifySms = async (title) => {
  client.messages.create({
    body: `Assignment: ${title} is due soon.`,
    from: '+18336220734',
    to: '+14042775585',
  }).then(message => console.log(message.sid));
};

const getCallouts = async () => {
  const response = await notion.databases.query({ database_id: "0c2965f05cfb4ad4839ec9b675df13bf" });

  for (const page of response.results) {
    if (page.properties.Class.relation[0].id !== chemistryid) continue;

    const blocks = await notion.blocks.children.list({ block_id: page.id });
    for (const block of blocks.results) {
      processBlock(block);
    }
  }
};

const processBlock = (block) => {
  if (!["column_list", "divider", "unsupported", "equation", "table", "image"].includes(block.type)) {
    if (block.type == "paragraph" && !block.paragraph.rich_text.length > 0) return
    try {
      return block[block.type].rich_text[0].plain_text;
    } catch (e) {
      console.error(e);
      process.exit(0);
    }
  }
  return null;
};

const getPage = async (pageid) => {
  let pageinfo = {
    id: pageid
  }
  const response = await notion.databases.query({ database_id: "0c2965f05cfb4ad4839ec9b675df13bf" });

  for (const page of response.results) {
    if (pageid && page.id !== pageid) continue;

    const title = page.properties.Name.title[0].plain_text;
    pageinfo = {
      ...
      title
    }
    const blocks = await notion.blocks.children.list({ block_id: page.id });
    let text = "";

    for (const block of blocks.results) {
      const processedText = processBlock(block);
      text += processedText + "\n";
    }

    fs.writeFileSync(`./logs/${title}.txt`, text, 'utf8', (err) => {
      if (err) throw err;
      console.log('The file has been saved!');
    });
  }

  return pageinfo;
};

const getPageIdByName = async (pageName) => {
  // Query the database using the provided DBID
  const response = await notion.databases.query({ database_id: notesdb });

  // Search the database for a page with the specified name
  const page = response.results.find(p =>
    p.properties.Name.title[0]?.plain_text === pageName
  );

  // If found, return the page ID
  return page ? page.id : 'Page not found';
};

const getPagesByUnit = async (unitName) => {
  const databaseId = notesdb
  // Query the database using the provided databaseId
  const response = await notion.databases.query({ database_id: databaseId });

  // Filter the pages based on the Unit property
  const pages = response.results.filter(p =>
    p.properties.Unit?.select?.name === unitName
  );

  // If pages are found, return them
  return pages?.length > 0 ? pages.map(page => page.id) : 'No pages found';
};


// v1 - no rewrite
// (async () => {
//   const pages = await getPagesByUnit("Unit 2")
//   pages.forEach(async (page) => {
//     await getPage(page)
//   })

//   const content = await readFilesFromDirectory("./logs")
//   // Make a request to chatgpt
//   const chatCompletion = await openai.chat.completions.create({
//     model: 'gpt-4',
//     messages: [
//       { role: "system", content: "You are an expert chemistry teacher. When I ask for help to create a study guide, you will reply with a markdown document that contains questions and information in the format of a study guide. These questions and information should be about topics from the notes provided. You should have at least 30 questions. Include 'key terms' from each lesson as well as important definitions." },
//       { role: 'user', content: 'Create a study guide based on the following notes: ```\n' + content + "```" }
//     ],
//     max_tokens: 5000
//   })

//   const response = await chatCompletion.choices[0].message.content
//   console.log(response)

//   fs.writeFileSync("output1.md", response, 'utf-8')


// })()
// v2 rewritten shit
(async () => {
  const pages = await getPagesByUnit("Unit 2")
  pages.forEach(async (page) => {
    await getPage(page)
  })

  // Rewrite the notes for each file
  const fileNames = fs.readdirSync("./logs");
  for (const fileName of fileNames) {
    let content;
    // Construct the full file path
    const filePath = path.join("./logs", fileName);

    // Parse the file path to get the title (file name without extension)
    const title = path.parse(filePath).name;

    // Read the content of the file
    let fileContent = "Title" + title + fs.readFileSync(filePath, 'utf8');

    // Add the title and file content to the content variable
    content += `Title: ${title}\n${fileContent}\n\n`; // adding a newline to separate content of files

    const rewriteFile = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: "system", content: "You are an expert chemistry teacher. You will rewrite my notes to ensure that all topics mentioned are thoroughly explained and any missing information is filled in." },
        { role: 'user', content: 'Rewrite the following so that all topics mentioned are thoroughly explained and any missing information is filled in. : ```\n' + content + "```" }
      ],
      max_tokens: 4000

    })

    console.log(await rewriteFile)
    const response = await rewriteFile.choices[0].message.content
    // console.log(content)
    fs.writeFileSync(`./logs/${title}.txt`, response, 'utf-8')

  }


  const content = await readFilesFromDirectory("./logs")
  // Make a request to chatgpt
  const chatCompletion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: "system", content: "You are an expert chemistry teacher. When I ask for help to create a study guide, you will reply with a markdown document that contains questions and information in the format of a study guide. These questions and information should be about topics from the notes provided. You should have at least 30 questions. Include 'key terms' from each lesson as well as important definitions." },
      { role: 'user', content: 'Create a study guide based on the following notes: ```\n' + content + "```" }
    ],
    max_tokens: 5000
  })

  const response = await chatCompletion.choices[0].message.content
  console.log(response)

  fs.writeFileSync("output2.md", response, 'utf-8')


})()

