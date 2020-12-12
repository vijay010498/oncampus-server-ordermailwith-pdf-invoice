const functions = require('firebase-functions');
const admin = require('firebase-admin');
const sgmail = require('@sendgrid/mail');
const ORDERDB = functions.config().database.orderdb;
const PDFDocument = require("pdfkit");
const moment = require('moment');
const {Storage} = require('@google-cloud/storage');
const storage = new Storage ({projectId: "eatitv2-75508"});
const bucket = storage.bucket('eatitv2-75508-client-invoices');

admin.initializeApp();
const API_KEY = functions.config().sendgrid.key;
var TEMPLATE_ID;
sgmail.setApiKey(API_KEY);
const runTimeOpts = {
    timeoutSeconds: 300,
    memory: '1GB'
}
exports.sendOrderConfirmedInvoiceEmail= 
functions
    .runWith(runTimeOpts)
    .database.instance(ORDERDB).ref('/Orders/{orderId}')
    .onWrite(async (change, context) =>
    {
              const snapshot = change.after;
              const order = snapshot.val();
              //orderId, orderDate, restaurantName, userName,deliveryAddress,itemName,quantity,price,grandTotal
              const orderId = context.params.orderId;
              const orderDate = order.transactionTime;
              const restaurantName = order.restaurantName.toLowerCase();
              const userName  = order.userName;
              const deliveryAddress = order.shippingAddress;
              const userEmail = order.userEmail;
              const isPickup = order.pickup;
              const grandTotal = order.totalPayment;
              const deliveryCharges = order.deliveryCharges;
              const itemTotal = order.onlyFoodPrice;
              const packingCharges = order.packingCharges;
              const OTP = order.otp;
              var itemList = order.cartItemList;
              const currentStatus = order.orderStatus;
              console.log('Order Id',orderId);
              console.log('orderDate',orderDate);
              console.log('restaurantName',restaurantName);
              console.log('userName',userName);
              console.log('deliveryAddress',deliveryAddress);
              console.log('userEmail',userEmail);
              console.log('isPickup',isPickup);
              console.log('Cart item List',itemList);
              console.log('deliveryCharges',deliveryCharges);
              console.log('itemTotal',itemTotal);
              console.log('packingCharges',packingCharges);

              if(currentStatus == 1){
                //create invoice pdf
              const invoice = {
                  orderNumber : context.params.orderId,
                  order:order
              };
              return createInvoice(invoice,order,orderId,orderDate,restaurantName,userName
                ,deliveryAddress,userEmail,isPickup,grandTotal,deliveryCharges,itemTotal,
                packingCharges,OTP,itemList,currentStatus);
              }
              else
                return null;

    });


    
    //Generate Pdf Function
    function createInvoice(invoice,order,orderId,orderDate,restaurantName,userName
      ,deliveryAddress,userEmail,isPickup,grandTotal,deliveryCharges,itemTotal,
      packingCharges,OTP,itemList,currentStatus) 
      {
                    let doc = new PDFDocument({ size: "A4", margin: 50 });
                  
                    generateHeader(doc);
                    generateCustomerInformation(doc, invoice);
                    generateInvoiceTable(doc, invoice);
                    generateFooter(doc);
                    generateDisclaimer(doc,invoice);
                  
                    const filename = order.userId +"/"+orderId +'.pdf'; 
                    const file = bucket.file(filename);
                    const bucketWriteFileStream = file.createWriteStream();
                    doc.pipe(bucketWriteFileStream);
                    doc.end();
                        bucketWriteFileStream.on('finish', function(response)
                        {
                                console.log('PDF UPLOADED:)',response);
                                return sendMailWithInvoice(filename,order,orderId,orderDate,restaurantName,userName
                                  ,deliveryAddress,userEmail,isPickup,grandTotal,deliveryCharges,itemTotal,
                                  packingCharges,OTP,itemList,currentStatus)
                        });

                      bucketWriteFileStream.on("error", function (err) 
                      {
                            console.error(err);
                      });


      }

    async function sendMailWithInvoice(filename,order,orderId,orderDate,restaurantName,userName
      ,deliveryAddress,userEmail,isPickup,grandTotal,deliveryCharges,itemTotal,
      packingCharges,OTP,itemList,currentStatus) 
      {
                    const file = bucket.file(filename);
                    file.download( async function(error, contents){
                      if(error){
                        console.log("PDF DOWNLOAD", error);
                      }
                      else
                      {
                              console.log("PDF DOWNLOADED",contents.toString("base64"));
                              const pdfInvoice = contents.toString("base64");
                              if(!isPickup)
                              {
                                TEMPLATE_ID = functions.config().sendgrid.templateorderconfirmeddelivery;
                              }
                              else if(isPickup)
                              {
                                  TEMPLATE_ID = functions.config().sendgrid.templateorderconfirmedpickup;
                              }
                            if(!isPickup)
                                  {
                                      //Delivery order send mail
                                      const msg = {
                                          to:{
                                              email:userEmail,
                                              name:userName
                                          },
                                          from:{
                                              email: 'orderupdate@mails.oncampus.in',
                                              name: 'onCampus.in'
                
                                          },
                                          reply_to:{
                                              email:'contact@oncampus.in',
                                              name:'onCampus.in'
                                          },
                                        
                                          click_tracking:{
                                              enable:true,
                                              enable_text:true
                              
                                          },
                                          open_tracking:{
                                              enable:true
                              
                                          },
                                          templateId: TEMPLATE_ID,
                                          dynamic_template_data: {
                                              orderId: orderId,
                                              orderDate: orderDate,
                                              restaurantName: restaurantName,
                                              userName: userName,
                                              deliveryAddress: deliveryAddress,
                                              itemTotal:itemTotal,
                                              packingCharges:packingCharges,
                                              deliveryCharges:deliveryCharges,
                                              grandTotal:grandTotal,
                                              orderOTP:OTP,
                                              items:itemList,
                                          },
                                          attachments:[
                                            {
                                            content:pdfInvoice,
                                            filename: "oncampus-" + orderId,
                                            type: "application/pdf",
                                            disposition: "attachment"
                                            }
                                          ]
                
                                      };
                                      return await sgmail.send(msg)
                                          .then(() =>{
                                              console.log("Email sent successfully");
                                          }).catch((error) =>{
                                              console.log('Email sending error: ',error);
                                          });
                                    }
                                else
                                  {
                                      //Pickup order send mail
                                      const msg = {
                                          to:{
                                              email:userEmail,
                                              name:userName
                                          },
                                          from:{
                                              email: 'orderupdate@mails.oncampus.in',
                                              name: 'onCampus.in'
                
                                          },
                                          reply_to:{
                                              email:'contact@oncampus.in',
                                              name:'onCampus.in'
                                          },
                                    
                                          click_tracking:{
                                              enable:true,
                                              enable_text:true
                              
                                          },
                                          open_tracking:{
                                              enable:true
                              
                                          },
                                          templateId: TEMPLATE_ID,
                                          dynamic_template_data: {
                                              orderId: orderId,
                                              orderDate: orderDate,
                                              restaurantName: restaurantName,
                                              userName: userName,
                                              deliveryAddress: deliveryAddress,
                                              itemTotal:itemTotal,
                                              packingCharges:packingCharges,
                                              grandTotal:grandTotal,
                                              orderOTP:OTP,
                                              items:itemList,
                                          },
                                          attachments:[
                                            {
                                            content:pdfInvoice,
                                            filename: "oncampus-" + orderId,
                                            type: "application/pdf",
                                            disposition: "attachment"
                                            }
                                          ]
                                      };
                                      return await sgmail.send(msg)
                                          .then(() =>{
                                              console.log("Email sent successfully");
                                          }).catch((error) =>{
                                              console.log('Email sending error: ',error);
                                          });
                                  } 
                      }
                    });
                  
      }
    


        //Creating pdf functions
        function generateHeader(doc) 
        {
              doc
                .image("./onCampus-logo.jpg", 50, 45, { width: 50 })
                .fillColor("#005048")
                .fontSize(20)
                .text("oncampus.", 110, 57)
                .fontSize(10)
                .text("oncampus Pvt Ltd.", 200, 50, { align: "right" })
                .text("365-A Suramangalam main road,", 200, 65, { align: "right" })
                .text("Salem, TN, 636005", 200, 80, { align: "right" })
                .moveDown();
        }
    
    function generateCustomerInformation(doc, invoice)
     {
              doc
                .fillColor("#005048")
                .fontSize(20)
                .text("Order Invoice", 50, 160);
            
              generateHr(doc, 185);
            
              const customerInformationTop = 200;
            
              doc
                .fillColor("#005048")
                .fontSize(10)
                .text("Order Number:", 50, customerInformationTop)
                .font("Helvetica-Bold")
                .text(invoice.orderNumber, 150, customerInformationTop)
                .font("Helvetica")
                .text("Order Date:", 50, customerInformationTop + 15)
                .text(moment(invoice.order.createDate).format("DD-MM-YYYY"), 150, customerInformationTop + 15)
                .text("Order Amount:", 50, customerInformationTop + 30)
                .text(
                  "Rs."+(invoice.order.totalPayment),
                  150,
                  customerInformationTop + 30
                )
            
                .font("Helvetica-Bold")
                .text(invoice.order.userName, 300, customerInformationTop)
                .font("Helvetica")
                .text(invoice.order.userPhone, 300, customerInformationTop + 15)
                .text(
                  invoice.order.userEmail,
                  300,
                  customerInformationTop + 30
                )
                .moveDown();
            
              generateHr(doc, 252);
      }
    
    function generateInvoiceTable(doc, invoice) 
    {
            let i;
            const invoiceTableTop = 330;
          
            doc.font("Helvetica-Bold");
            generateTableRow(
              doc,
              invoiceTableTop,
              "Item",
              "Quantity",
              "Price",
            );
            generateHr(doc, invoiceTableTop + 20);
            doc.font("Helvetica");
          
            for (i = 0; i < invoice.order.cartItemList.length; i++) {
              const item = invoice.order.cartItemList[i];
              const position = invoiceTableTop + (i + 1) * 30;
              generateTableRow(
                doc,
                position,
                item.foodName,
                item.foodQuantity,
                "Rs"+(item.foodPrice * item.foodQuantity),
              );
          
              generateHr(doc, position + 20);
            }
          
            const subtotalPosition = invoiceTableTop + (i + 1) * 30;
            generateTableRow(
              doc,
              subtotalPosition,
              "",
              "Item Total",
              "Rs."+(invoice.order.onlyFoodPrice)
            );
          
            const paidToDatePosition = subtotalPosition + 20;
            generateTableRow(
              doc,
              paidToDatePosition,
              "",
              "Restaurant Packing Charge's:",
              "Rs."+(invoice.order.packingCharges)
            );
          
            const duePosition = paidToDatePosition + 25;
            doc.font("Helvetica");
            generateTableRow(
              doc,
              duePosition,
              "",
              "Delivery Charge's",
              "Rs."+(invoice.order.deliveryCharges)
            );
            const duePosition1 = duePosition + 25;
            doc.font("Helvetica");
            generateTableRow(
              doc,
              duePosition1,
              "",
              "Grand Total:",
              "Rs."+(invoice.order.totalPayment)
            );
            doc.font("Helvetica");
    }
    
  
        function generateFooter(doc) 
        {
              doc.font("Helvetica");
              doc.fillColor("black")
                .fontSize(10)
                .text(
                  "Thank you for your business.",
                  50,
                  690,
                  { align: "center", width: 500 }
                );
        }
        function generateDisclaimer(doc)
        {
              doc
                .fontSize(10)
                .text(
                  "Disclaimer:This is an acknowledgement of order confirmation and not an actual invoice. Details mentioned above including the menu prices and taxes (as applicable) are as provided by the Restaurant to onCampus. Responsibility of charging (or not charging) taxes lies with the Restaurant and onCampus disclaims any liability that may arise in this respect.  ",
                  50,
                  720,
                  { align: "center", width: 500 }
                );
        }
    
    function generateTableRow(
      doc,
      y,
      item,
      quantity,
      price,
    ) {
      doc
        .fillColor("#005048")
        .fontSize(10)
        .text(item, 50, y)
        .text(quantity, 355, y)
        .text(price, 0, y, { align: "right" });
    }
    
    function generateHr(doc, y) {
      doc
        .strokeColor("#005048")
        .lineWidth(1)
        .moveTo(50, y)
        .lineTo(550, y)
        .stroke();
    }
    
      
      
      