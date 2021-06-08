const puppeteer= require('puppeteer');
const fs= require('fs-extra');
const hbs = require('handlebars');
const path= require('path');
const enrollments = require('./pickup.json');
const cheerio = require('cheerio');
const pdfMerge = require('easy-pdf-merge');

const inputDir = path.join(process.cwd(),'templates','input_files');

const interimPdfs = path.join(process.cwd(),'templates','pdf_files');

fs.mkdir(interimPdfs,err => {
  if(err) {
    console.error("Could not create a folder. Please check permissions and try again.");
  }
});

const compile = async function(fileName,data) {
  const filePath=path.join(inputDir,`${fileName}`);
  const html = await fs.readFile(filePath,'utf-8');
  return hbs.compile(html)(data);
};

const mergeAllPdfs = async (pdfList) => {
  if(pdfList.length === 1) {
    fs.copyFileSync(pdfList[0],"pickList.pdf");
  } else if(pdfList.length > 1){
    pdfMerge(pdfList,"pickList.pdf",function (err) {
      if (err) {
        return console.log(err)
      }
      // fs.rmdirSync(interimPdfs, { recursive: true });
    });
  }
}


(async () => {
    try{
        // 2. Create PDF from static HTML
        const pdfList = [];
        let filesProcessed = 0;

        fs.readdirSync(inputDir).forEach(async (file, index, array) => {
          const browser = await puppeteer.launch();
          const page = await browser.newPage();
          const content = await compile(file,enrollments);
          await page.setContent(content);

          // IF FILENAME IS IN THIS FORMAT [student_id]_[timestamp]_[timezone].html
          const [studentId, timestamp, timezone] = file.split("_");
          const timeToDate = new Date(timestamp*1000);
          console.log(timestamp, timeToDate);
          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const hours = timeToDate.getHours();
          const displayDate = `${months[timeToDate.getMonth()]} ${timeToDate.getDate()}, ${timeToDate.getFullYear()} - ${hours > 12 ? hours - 12: hours}:${timeToDate.getMinutes()} ${hours > 12 ? "AM" : "PM"}`; 
          const footerTemplate = `
          <div style="width:100%; height: 20px; color:black; margin: 0px 20px;">
            <span style="display:inline-block; font-size: 7px;width: 20%;text-align:left;color: #6f6f6f;letter-spacing:0.6px;padding-left: 10px;">Student Id: ${studentId}</span>
            <span style="display:inline-block; font-size: 7px;width: 50%;text-align:center;color: #6f6f6f;letter-spacing:0.6px;">Created: ${displayDate} ${timezone.split(".")[0]}</span>
            <span style="display:inline-block; font-size: 7px;width:20%;text-align:right;color: #6f6f6f;letter-spacing:0.6px;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></span> 
          </div>
          `;

          const newFile = path.join(`${interimPdfs}`,`${file}.pdf`);
          await page.pdf({ 
            path: newFile, 
            format: 'A4',
            displayHeaderFooter: true,
            headerTemplate: `<div style="height:100px;min-width:100%;">&nbsp;</div>`,
            footerTemplate: footerTemplate,
            margin: { top: '100px', bottom: '100px' }
          });
          await browser.close();
          pdfList.push(newFile);
          filesProcessed++;
          if(filesProcessed === array.length) {
            mergeAllPdfs(pdfList);
          }
        });
        
    }catch(e){
        console.log(e);
    }
    
  })()