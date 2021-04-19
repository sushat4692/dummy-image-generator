import sharp from "sharp";
import path from "path";
import fs from "fs";
import csvParse from "csv-parse";
import TextToSvg from "text-to-svg";
import svg2img from "svg2img";

const allowedTypes = ["jpg", "gif", "png"];
const textToSVG = TextToSvg.loadSync();

const main = async () => {
    // Preparing Directory
    const targetPath = path.join(process.cwd(), "dist");
    if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isDirectory()) {
        fs.mkdirSync(targetPath);
    }

    // Parsing CSV
    const csvFile = path.join(process.cwd(), "setting.csv");
    if (!fs.existsSync(csvFile)) {
        return;
    }

    const buffer = fs.readFileSync(csvFile);
    const records = await (async () => {
        return new Promise<unknown[][]>((resolve, reject) => {
            csvParse(buffer, (err, records, _info) => {
                if (err) {
                    console.log(err);
                    return reject(err);
                }

                return resolve(records);
            });
        });
    })();

    if (!records) {
        return;
    }

    if (records.length < 2) {
        console.error("Not found records");
    }

    // Remove Header
    records.shift();

    let row = 1;
    await Promise.all(
        records.map(async ([w, h, type]) => {
            row += 1;
            let hasError = false;

            // Check Type
            if (!allowedTypes.some((allowedType) => allowedType === type)) {
                console.error(`#${row}: Invalid type`);
                hasError = true;
            }

            // Check Width
            const width = parseInt(w + "", 10);
            if (width <= 0) {
                console.error(`#${row}: Invalid width`);
                hasError = true;
            }

            // Check Height
            const height = parseInt(h + "", 10);
            if (height <= 0) {
                console.error(`#${row}: Invalid height`);
                hasError = true;
            }

            // Calculate Color
            const textColor = {
                r: Math.floor(Math.random() * 255),
                g: Math.floor(Math.random() * 255),
                b: Math.floor(Math.random() * 255),
            };
            const colorMax = Math.max(textColor.r, textColor.g, textColor.b);
            const colorMin = Math.min(textColor.r, textColor.g, textColor.b);
            const bgColor = {
                r: colorMax + colorMin - textColor.r,
                g: colorMax + colorMin - textColor.g,
                b: colorMax + colorMin - textColor.b,
            };

            // Make text
            const svgBuffer = await (async () => {
                return new Promise<Buffer>((resolve, reject) => {
                    const options: TextToSvg.GenerationOptions = {
                        x: 0,
                        y: 0,
                        fontSize: 72,
                        anchor: "top",
                        attributes: {
                            fill: `rgb(${textColor.r},${textColor.g},${textColor.b})`,
                            stroke: "none",
                        },
                    };
                    const svg = textToSVG.getSVG(`${w}x${h}.${type}`, options);
                    svg2img(
                        svg,
                        {
                            width: width * 0.8,
                            height: height * 0.8,
                            preserveAspectRatio: "xMidYMid meet",
                        },
                        (error, buffer) => {
                            if (error) {
                                console.error(error);
                                return reject(error);
                            }

                            return resolve(buffer);
                        }
                    );
                });
            })();

            if (!svgBuffer) {
                console.error(`#${row}: Failed to create text`);
                hasError = true;
            }

            // Finish if has Error
            if (hasError) {
                return;
            }

            // Show row info
            console.log(`#${row}: w ${width}px x h ${height}px / ${type}`);

            sharp({
                create: {
                    width,
                    height,
                    channels: type === "png" ? 4 : 3,
                    background:
                        type === "png"
                            ? {
                                  r: bgColor.r,
                                  g: bgColor.g,
                                  b: bgColor.b,
                                  alpha: 1,
                              }
                            : { r: bgColor.r, g: bgColor.g, b: bgColor.b },
                },
            })
                .composite([
                    {
                        input: svgBuffer,
                    },
                ])
                .toFile(path.join(targetPath, `${w}x${h}.${type}`));
        })
    );
};

main();
