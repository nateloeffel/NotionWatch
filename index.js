// Imports
const { Client } = require("@notionhq/client");
const client = require('twilio')(process.env['TWILIO_SID'], process.env['TWILIO_AUTH']);
const fs = require('fs');
const openai = require('openai')

// Constants
const notion = new Client({
  auth: process.env['NOTION_TOKEN'],
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
  if (!["column_list", "divider", "unsupported", "equation"].includes(block.type) &&
      block.type === "paragraph" && block.paragraph.rich_text.length > 0) {
    try {
      console.log(block[block.type].rich_text[0].plain_text);
    } catch (e) {
      console.error(e);
      console.log(block);
      process.exit(0);
    }
  }
};

const getPage = async (pageid) => {
  const response = await notion.databases.query({ database_id: "0c2965f05cfb4ad4839ec9b675df13bf" });

  for (const page of response.results) {
    if (pageid && page.id !== pageid) continue;

    const title = page.properties.Name.title[0].plain_text;
    const blocks = await notion.blocks.children.list({ block_id: page.id });
    let text = "";

    for (const block of blocks.results) {
      processBlock(block);
      text += block[block.type].rich_text[0]?.plain_text + "\n";
    }

    fs.writeFileSync(`${title}.txt`, text, 'utf8', (err) => {
      if (err) throw err;
      console.log('The file has been saved!');
    });
  }
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
  return pages.length > 0 ? pages : 'No pages found';
};

(async () => {
  const pages = await getPagesByUnit("Unit 2")
  pages.forEach( async (page) => {
    await getPage(page.id)
  })
})()

