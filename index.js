// Imports
const { Client } = require("@notionhq/client");
const client = require('twilio')(process.env['TWILIO_SID'], process.env['TWILIO_AUTH']);
const fs = require('fs');

// Constants
const notion = new Client({
  auth: process.env['NOTION_TOKEN'],
});
const chemistryid = "db07dcfa-9a94-4279-93ea-5b32691be978";
const humanid = "21d456da-f639-4619-b579-96668d20b68d";
const dbid = "1a57b0b38ba14b33a01bdcfd50d0ab1a"

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

const notesContent = async (pageid) => {
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

// Function Calls
notesContent("afc34a5a-c7ba-4a60-9510-395751451846");
// Uncomment these to use
// getCallouts();
// checkAssignments();
