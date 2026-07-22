const fs = require('fs');
const path = require('path');

function recover() {
  const pbPath = 'C:\\Users\\nullp\\.gemini\\antigravity\\conversations\\55ae8279-515c-45ec-aece-f3c95640689d.pb';
  if (!fs.existsSync(pbPath)) {
    console.error('PB file not found at:', pbPath);
    return;
  }

  const data = fs.readFileSync(pbPath);
  console.log('Read PB file. Size:', data.length, 'bytes');

  // We look for the start of the file content in the protobuf buffer.
  // The file starts with: import React, { useState, useRef, useMemo } from 'react'
  // In the protobuf, string fields are encoded with their UTF-8 content.
  // We can search for the byte sequence of "import React, { useState, useRef, useMemo } from 'react'"
  const searchStr = "import React, { useState, useRef, useMemo } from 'react'";
  const searchBuf = Buffer.from(searchStr, 'utf8');

  let index = -1;
  // Let's scan the file for occurrences of the search string.
  for (let i = 0; i <= data.length - searchBuf.length; i++) {
    let match = true;
    for (let j = 0; j < searchBuf.length; j++) {
      if (data[i + j] !== searchBuf[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      console.log('Found match at index:', i);
      index = i;
      // Let's inspect the surrounding bytes to see if we can find the end of the file.
      // The file ends with standard TSX code. We can search for the end of the React component,
      // or scan until the end of the protobuf string.
      // In protobuf, string fields are preceded by their length as a varint.
      // Let's try to extract a chunk of 45000 bytes from index.
      const chunk = data.slice(index, index + 50000);
      
      // We want to find the end of the TSX code. In the protobuf string, there might be escaped characters like \n, \", etc.
      // Wait, is the string raw or JSON-escaped?
      // Since it was sent in a tool call JSON payload, it is JSON-escaped:
      // "CodeContent": "import React, { useState, useRef, useMemo } from 'react'\n..."
      // So the newlines are literal '\n' characters (backslash and 'n') or actual newlines?
      // In the protobuf JSON, they are escaped as '\\n'.
      // Let's convert the chunk to a string and inspect it.
      let chunkStr = chunk.toString('utf8');
      
      // Let's find where the TSX code ends. We can find the last occurrence of the component exports, or we can look for the next JSON key or protobuf delimiter.
      // Let's save the raw chunk string to check its contents.
      fs.writeFileSync('extracted_raw.txt', chunkStr);
      console.log('Saved raw chunk to extracted_raw.txt');
    }
  }
}

recover();
