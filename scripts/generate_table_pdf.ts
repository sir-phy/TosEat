import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';

async function generatePDF() {
  // Ensure public folder exists
  const publicDir = path.resolve('./public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const outputPath = path.join(publicDir, 'gomeal_table_01_qr.pdf');
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 40, left: 40, right: 40 }
  });

  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  // Define color palette matching GoMeal's corporate identiy
  const darkNavy = '#0f172a'; // slate-900
  const borderGold = '#d97706'; // amber-600
  const goldMain = '#f59e0b'; // amber-500

  // Draw full-page border guides
  doc.rect(20, 20, 555, 802)
     .lineWidth(2)
     .strokeColor(darkNavy)
     .stroke();

  // Outer border with accent
  doc.rect(25, 25, 545, 792)
     .lineWidth(1)
     .strokeColor(borderGold)
     .stroke();

  // Background filled container
  doc.rect(30, 30, 535, 782)
     .fill(darkNavy);

  // Add decorative top banner elements
  doc.rect(30, 30, 535, 120)
     .fill('#1e293b'); // slate-800

  // Write "gomeal" logo text
  doc.fillColor('#ffffff')
     .font('Helvetica-Bold')
     .fontSize(42)
     .text('GOMEAL', 30, 60, { align: 'center', width: 535 });

  doc.fillColor(goldMain)
     .font('Helvetica-Bold')
     .fontSize(16)
     .text('PREMIUM DIGITAL DINING', 30, 110, { align: 'center', width: 535 });

  // Draw separator line
  doc.moveTo(150, 165)
     .lineTo(445, 165)
     .lineWidth(2)
     .strokeColor(goldMain)
     .stroke();

  // Main welcome invite text
  doc.fillColor('#ffffff')
     .font('Helvetica')
     .fontSize(19)
     .text('Welcome! Scan to Browse our Menu & Order', 30, 200, { align: 'center', width: 535 });

  doc.fillColor('#cbd5e1') // slate-300
     .font('Helvetica-Oblique')
     .fontSize(13)
     .text('Instant service directly from your smartphone', 30, 230, { align: 'center', width: 535 });

  // Generate QR Code as a high quality PNG buffer
  const qrUrl = 'https://ais-pre-e2xowgqoejq3nrghjmjrdc-222740740727.asia-southeast1.run.app/menu?table=01';
  
  // Create QR Code image with dark navy foreground and white background
  const qrImageBuffer = await QRCode.toBuffer(qrUrl, {
    width: 400,
    margin: 1,
    color: {
      dark: '#0f172a',
      light: '#ffffff'
    }
  });

  // Coordinates to center the QR code card
  const qrBoxX = 147; 
  const qrBoxY = 275;
  const qrSize = 300;

  // Draw a beautiful white card underneath the QR code to make it stand out
  doc.rect(qrBoxX - 15, qrBoxY - 15, qrSize + 30, qrSize + 55)
     .fill('#ffffff');

  // Draw a subtle border around the white card
  doc.rect(qrBoxX - 15, qrBoxY - 15, qrSize + 30, qrSize + 55)
     .lineWidth(3)
     .strokeColor(goldMain)
     .stroke();

  // Embed the QR Code image
  doc.image(qrImageBuffer, qrBoxX, qrBoxY, { width: qrSize, height: qrSize });

  // Add the "Table 01" label at the bottom of the QR card
  doc.fillColor(darkNavy)
     .font('Helvetica-Bold')
     .fontSize(24)
     .text('TABLE 01', qrBoxX - 15, qrBoxY + qrSize + 12, { align: 'center', width: qrSize + 30 });

  // Instructions
  doc.fillColor('#ffffff')
     .font('Helvetica-Bold')
     .fontSize(15)
     .text('EASY THREE STEP DINING', 30, 650, { align: 'center', width: 535 });

  const iconY = 685;
  // Step 1
  doc.fillColor(goldMain).font('Helvetica-Bold').fontSize(13).text('1. SCAN QR', 55, iconY, { width: 140, align: 'center' });
  doc.fillColor('#94a3b8').font('Helvetica').fontSize(10.5).text('Scan with your smartphone camera to load table menu.', 55, iconY + 22, { width: 140, align: 'center' });

  // Step 2
  doc.fillColor(goldMain).font('Helvetica-Bold').fontSize(13).text('2. SELECT ITEMS', 227, iconY, { width: 140, align: 'center' });
  doc.fillColor('#94a3b8').font('Helvetica').fontSize(10.5).text('Explore dishes, customize ingredients and place orders.', 227, iconY + 22, { width: 140, align: 'center' });

  // Step 3
  doc.fillColor(goldMain).font('Helvetica-Bold').fontSize(13).text('3. ENJOY & PAY', 399, iconY, { width: 140, align: 'center' });
  doc.fillColor('#94a3b8').font('Helvetica').fontSize(10.5).text('Food served hot to your table. Request bill directly.', 399, iconY + 22, { width: 140, align: 'center' });

  // Footer note
  doc.fillColor('#64748b') 
     .font('Helvetica')
     .fontSize(9.5)
     .text('GoMeal Smart Dining Ecosystem • Thank you for dining with us!', 30, 785, { align: 'center', width: 535 });

  doc.end();
  
  await new Promise((resolve) => {
    stream.on('finish', resolve);
  });
  console.log('Successfully generated beautiful Table 01 QR PDF flyer.');
}

generatePDF().catch(console.error);
