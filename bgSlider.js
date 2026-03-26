const images = ["img1.webp", "img2.webp", "img3.webp", "img4.webp"];
const layers = document.querySelectorAll(".bg-layer");
let index = 0;

if (layers.length >= 2) {
  images.forEach((src) => {
    const image = new Image();
    image.src = src;
  });

  layers[0].style.backgroundImage = `url('${images[0]}')`;
  layers[0].classList.add("active");

  setInterval(() => {
    const currentLayer = layers[index % 2];
    const nextLayer = layers[(index + 1) % 2];
    const nextImage = images[(index + 1) % images.length];

    nextLayer.style.backgroundImage = `url('${nextImage}')`;
    nextLayer.classList.add("active");
    currentLayer.classList.remove("active");

    index += 1;
  }, 5000);
}
